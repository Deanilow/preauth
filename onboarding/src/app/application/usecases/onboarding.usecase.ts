import { createHash, randomBytes, randomUUID } from 'crypto';
import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '../../infrastructure/di/tokens';

import { JwtVerifierPort } from '../ports/output/jwt-verifier.port';
import { ReplayStorePort } from '../ports/output/replay-store.port';
import { TokenServiceClient } from '../../infrastructure/clients/token-service.client';
import { SessionServiceClient } from '../../infrastructure/clients/session-service.client';
import { DeviceEnrollmentClient } from '../../infrastructure/clients/device-enrollment.client';
import { ClientConstants } from '../../infrastructure/clients/client.constants';
import { ContextTokenClaims, SessionTokenClaims } from '../ports/output/contracts/token-service';
import { SessionStateResponse } from '../ports/output/contracts/session-service';
import { OnboardingStep } from '../../domain/entities/onboarding-step';
import {
  OnboardingInputPort,
  RequestContext,
  StartRequest,
  StartResponse,
  VerifyOtpRequest,
  VerifyFaceRequest,
  VerifyOcrRequest,
  SelectProductsRequest,
  CreatePasswordRequest,
  StepAdvancedResponse,
} from '../ports/input/onboarding.input';
import { BusinessError } from 'src/shared/errors/integration.error';
import { logger } from 'app/infrastructure/logger';

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

/**
 * Genera un `sub` (GUID) aleatorio para identificar al usuario dentro de la sesión.
 * No se deriva del DNI: cada onboarding genera un `sub` nuevo, aunque el DNI se repita.
 */
function generateUserSub(): string {
  return randomUUID();
}

function generateOtp(): string {
  return (randomBytes(3).readUIntBE(0, 3) % 1_000_000).toString().padStart(6, '0');
}

/**
 * Orquesta las 5 fases de onboarding (start -> otp -> face -> products -> password),
 * validando en cada paso: firma+audiencia+scope del JWT (contextToken/sessionToken),
 * anti-replay sobre Redis, vinculación de canal e IP, y la secuencia estricta de la
 * state machine que vive en Session Service.
 */
@injectable()
export class OnboardingUseCase implements OnboardingInputPort {
  constructor(
    @inject(DI_TOKENS.JwtVerifierPort)
    private readonly jwtVerifier: JwtVerifierPort,
    @inject(DI_TOKENS.ReplayStorePort)
    private readonly replayStore: ReplayStorePort,
    @inject(DI_TOKENS.TokenServiceClient)
    private readonly tokenServiceClient: TokenServiceClient,
    @inject(DI_TOKENS.SessionServiceClient)
    private readonly sessionServiceClient: SessionServiceClient,
    @inject(DI_TOKENS.DeviceEnrollmentClient)
    private readonly deviceEnrollmentClient: DeviceEnrollmentClient,
  ) { }

  // ─── Fase 2: /onboarding/start ────────────────────────────────────────────

  async start(req: StartRequest): Promise<StartResponse> {
    const claims = await this.jwtVerifier.verify<ContextTokenClaims>(
      req.contextToken,
      ClientConstants.expectedContextTokenAud,
    );

    if (claims.scope !== 'preauth:onboarding.start') {
      throw new BusinessError('INVALID_TOKEN', `unexpected scope='${claims.scope}'`);
    }
    if (!claims.jti) {
      throw new BusinessError('INVALID_TOKEN', 'contextToken missing jti');
    }

    // Single-use: el contextToken solo puede canjearse una vez.
    const isFirstUse = await this.replayStore.consumeOnce(
      `ctx:jti:${claims.jti}`,
      ClientConstants.contextTokenReplayTtlSeconds,
    );
    if (!isFirstUse) {
      throw new BusinessError('TOKEN_REPLAY', `jti=${claims.jti}`);
    }

    this.assertIpBinding(claims.ipHash, req.ctx.clientIp);
    this.assertDni(req.dni);

    const session = await this.sessionServiceClient.getSession(req.sessionHandle, req.ctx.correlationId);
    this.assertChannelMatches(claims.channel, session.channel);
    this.assertStep(session, 'context_issued');

    const userSub = generateUserSub();

    const updated = await this.sessionServiceClient.advanceStep(req.sessionHandle, {
      fromStep: 'context_issued',
      toStep: 'otp_pending',
      metadata: { dni: req.dni, userSub },
    }, req.ctx.correlationId);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Onboarding] start OK -> ocr_pending');

    const sessionToken = await this.issueSessionToken(req.sessionHandle, session.channel, req.ctx);

    return { sessionToken: sessionToken.token, step: updated.step, expiresIn: sessionToken.expiresIn };
  }

  // ─── Fase 3: pasos protegidos por sessionToken ────────────────────────────

  async verifyOtp(req: VerifyOtpRequest): Promise<StepAdvancedResponse> {
    const session = await this.fase3Guard(req.sessionToken, req.sessionHandle, 'otp_pending', req.ctx);

    // Simulado: la validación real del código OTP la realiza el flujo legacy que se
    // integrará por fuera de este servicio. Aquí solo se avanza el estado.
    const updated = await this.sessionServiceClient.advanceStep(req.sessionHandle, {
      fromStep: 'otp_pending',
      toStep: 'ocr_pending',
    }, req.ctx.correlationId);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Onboarding] otp OK -> password_pending');
    return { step: updated.step, sub: session.userSub };
  }

  async verifyFace(req: VerifyFaceRequest): Promise<StepAdvancedResponse> {
    await this.fase3Guard(req.sessionToken, req.sessionHandle, 'face_pending', req.ctx);

    // Simulado: la validación real del rostro la realiza el flujo legacy que se
    // integrará por fuera de este servicio. Aquí solo se avanza el estado.

    // El OTP se genera recién aquí: en el nuevo orden, otp_pending queda después de
    // face_pending, así que el código debe existir al crear ese estado.
    const otpCode = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 300_000).toISOString(); // 300s == TTL de otp_pending

    const updated = await this.sessionServiceClient.advanceStep(req.sessionHandle, {
      fromStep: 'face_pending',
      toStep: 'password_pending',
      metadata: { otpCode, otpExpiresAt },
    }, req.ctx.correlationId);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Onboarding] face OK -> otp_pending');
    return { step: updated.step };
  }

  async verifyOcr(req: VerifyOcrRequest): Promise<StepAdvancedResponse> {
    await this.fase3Guard(req.sessionToken, req.sessionHandle, 'ocr_pending', req.ctx);

    const updated = await this.sessionServiceClient.advanceStep(req.sessionHandle, {
      fromStep: 'ocr_pending',
      toStep: 'face_pending',
    }, req.ctx.correlationId);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Onboarding] ocr OK -> face_pending');
    return { step: updated.step };
  }

  async selectProducts(req: SelectProductsRequest): Promise<StepAdvancedResponse> {
    await this.fase3Guard(req.sessionToken, req.sessionHandle, 'password_pending', req.ctx);

    if (!Array.isArray(req.productIds) || req.productIds.length === 0) {
      throw new BusinessError('INVALID_PRODUCTS_SELECTION');
    }

    const updated = await this.sessionServiceClient.advanceStep(req.sessionHandle, {
      fromStep: 'password_pending',
      toStep: 'completed',
    }, req.ctx.correlationId);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Onboarding] products OK -> completed');
    return { step: updated.step };
  }

  // ─── Guard compartido por los 4 endpoints de Fase 3 ───────────────────────

  private async fase3Guard(
    sessionToken: string,
    sessionHandle: string,
    expectedStep: OnboardingStep,
    ctx: RequestContext,
  ): Promise<SessionStateResponse> {
    if (!ctx.requestId) {
      throw new BusinessError('MISSING_REQUEST_ID');
    }

    const claims = await this.jwtVerifier.verify<SessionTokenClaims>(
      sessionToken,
      ClientConstants.expectedSessionTokenAud,
    );

    if (claims.scope !== 'onboarding.active') {
      throw new BusinessError('INVALID_TOKEN', `unexpected scope='${claims.scope}'`);
    }
    if (claims.sub !== `session:${sessionHandle}`) {
      throw new BusinessError('INVALID_TOKEN', 'sessionToken does not match sessionHandle');
    }

    // sessionToken es multi-use: el anti-replay es por request (X-Request-Id), no por jti.
    const isFirstUse = await this.replayStore.consumeOnce(
      `req:${sessionHandle}:${ctx.requestId}`,
      ClientConstants.requestIdempotencyTtlSeconds,
    );
    if (!isFirstUse) {
      throw new BusinessError('REQUEST_REPLAYED', `requestId=${ctx.requestId}`);
    }

    this.assertIpBinding(claims.ipHash, ctx.clientIp);

    const session = await this.sessionServiceClient.getSession(sessionHandle, ctx.correlationId);
    this.assertChannelMatches(claims.channel, session.channel);
    this.assertStep(session, expectedStep);

    return session;
  }

  // ─── Validaciones auxiliares ──────────────────────────────────────────────

  private assertIpBinding(tokenIpHash: string | undefined, clientIp: string): void {
    if (tokenIpHash && tokenIpHash !== sha256Hex(clientIp)) {
      throw new BusinessError('IP_BINDING_MISMATCH');
    }
  }

  private assertChannelMatches(tokenChannel: string | undefined, sessionChannel: string): void {
    if (tokenChannel && tokenChannel !== sessionChannel) {
      throw new BusinessError('CHANNEL_MISMATCH');
    }
  }

  private assertStep(session: SessionStateResponse, expected: OnboardingStep): void {
    if (session.step !== expected) {
      throw new BusinessError('INVALID_STEP_SEQUENCE', `session is at '${session.step}', expected '${expected}'`);
    }
    if (new Date(session.stepExpiry).getTime() <= Date.now()) {
      throw new BusinessError('STEP_EXPIRED');
    }
  }

  private assertDni(dni: string): void {
    if (!/^[0-9]{8}$/.test(dni)) {
      throw new BusinessError('INVALID_DNI');
    }
  }

  private assertPassword(password: string): void {
    if (password.length < 8 || !/[0-9]/.test(password)) {
      throw new BusinessError('INVALID_PASSWORD');
    }
  }

  private async issueSessionToken(sessionHandle: string, channel: string, ctx: RequestContext) {
    try {
      return await this.tokenServiceClient.issueSessionToken({
        sessionHandle,
        channel,
        clientIp: ctx.clientIp,
        correlationId: ctx.correlationId,
      });
    } catch (err) {
      logger.error({ correlationId: ctx.correlationId, err: (err as Error).message }, '[Onboarding] token-service unreachable issuing sessionToken');
      throw err;
    }
  }
}
