import { createHash, randomUUID } from 'crypto';
import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '../../infrastructure/di/tokens';

import { JwtVerifierPort } from '../ports/output/jwt-verifier.port';
import { ReplayStorePort } from '../ports/output/replay-store.port';
import { TokenServiceClient } from '../../infrastructure/clients/token-service.client';
import { SessionServiceClient } from '../../infrastructure/clients/session-service.client';
import { DeviceEnrollmentClient } from '../../infrastructure/clients/device-enrollment.client';
import { MessengerClient } from '../../infrastructure/clients/messenger.client';
import { ClientConstants } from '../../infrastructure/clients/client.constants';
import { ContextTokenClaims, SessionTokenClaims } from '../ports/output/contracts/token-service';
import { SessionStateResponse } from '../ports/output/contracts/session-service';
import { OnboardingStep } from '../../domain/entities/onboarding-step';
import {
  OnboardingInputPort,
  RequestContext,
  StartRequest,
  StartResponse,
  SendOtpRequest,
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

/**
 * Orquesta las fases de onboarding (start -> otp -> ocr -> face), avanzando la
 * state machine que vive en Session Service. La generación/verificación del OTP
 * se delega al Messenger Service; este orquestador solo valida el paso (fase3Guard)
 * y avanza. La validación real de OCR/biometría la realiza un proceso externo.
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
    @inject(DI_TOKENS.MessengerClient)
    private readonly messengerClient: MessengerClient,
  ) { }

  // ─── Fase 2: /onboarding/start ────────────────────────────────────────────

  async start(req: StartRequest): Promise<StartResponse> {
    const claims = await this.jwtVerifier.verify<ContextTokenClaims>(
      req.contextToken,
      ClientConstants.expectedContextTokenAud,
    );

    if (claims.scope !== 'preauth:start') {
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

    const session = await this.sessionServiceClient.getSession(req.sessionHandle, req.ctx.correlationId);
    this.assertChannelMatches(claims.channel, session.channel);
    this.assertStep(session, 'context_issued');

    // El DNI aplica a los flujos con identificación (appclient/onboarding); otp_only no lo usa.
    if (session.flowType !== 'otp_only') {
      this.assertDni(req.dni);
    }

    const userSub = generateUserSub();

    // start ya NO genera el OTP: el código lo genera/entrega el Messenger Service
    // (POST /otp/generate) cuando se llame a /onboarding/otp/send.
    const metadata = req.dni ? { dni: req.dni, userSub } : { userSub };
    const updated = await this.sessionServiceClient.advanceStep(req.sessionHandle, {
      fromStep: 'context_issued',
      toStep: 'otp_pending',
      metadata,
    }, req.ctx.correlationId);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Onboarding] start OK -> otp_pending');

    const sessionToken = await this.issueSessionToken(req.sessionHandle, session.channel, session.flowType, req.ctx);

    return { sessionToken: sessionToken.token, step: updated.step, expiresIn: sessionToken.expiresIn };
  }

  // ─── Fase 3: pasos protegidos por sessionToken ────────────────────────────

  async sendOtp(req: SendOtpRequest): Promise<StepAdvancedResponse> {
    const session = await this.fase3Guard(req.sessionToken, req.sessionHandle, 'otp_pending', req.ctx);

    // Delegar la generación/reenvío del OTP al Messenger Service. Reenviar N veces
    // sobrescribe el código en Redis (messenger) sin tocar la state machine.
    const result = await this.messengerClient.generateOtp(req.sessionHandle, req.sessionToken, req.ctx.correlationId);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Onboarding] otp send -> messenger OK');
    return { step: session.step };
  }

  async verifyOtp(req: VerifyOtpRequest): Promise<StepAdvancedResponse> {
    const session = await this.fase3Guard(req.sessionToken, req.sessionHandle, 'otp_pending', req.ctx);

    if (!req.otpCode) {
      throw new BusinessError('INVALID_OTP', 'otpCode is required');
    }

    // Delegar la verificación del OTP al Messenger Service.
    const otp = await this.messengerClient.verifyOtp(req.sessionHandle, req.otpCode, req.sessionToken, req.ctx.correlationId);
    if (!otp.valid) {
      throw new BusinessError('INVALID_OTP');
    }

    // El siguiente paso depende del flujo de la sesión: el mismo orquestador
    // sirve para distintos flujos de canal.
    const nextStepByFlow: Record<string, OnboardingStep> = {
      appclient: 'ocr_pending',
      onboarding: 'confirmed',
      otp_only: 'completed',
    };
    const toStep = nextStepByFlow[session.flowType];
    if (!toStep) {
      throw new BusinessError('INVALID_STEP_SEQUENCE', `unknown flowType '${session.flowType}'`);
    }

    const updated = await this.sessionServiceClient.advanceStep(req.sessionHandle, {
      fromStep: 'otp_pending',
      toStep,
    }, req.ctx.correlationId);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle, toStep }, '[Onboarding] otp OK');
    return { step: updated.step };
  }

  async verifyFace(req: VerifyFaceRequest): Promise<StepAdvancedResponse> {
    const session = await this.fase3Guard(req.sessionToken, req.sessionHandle, 'face_pending', req.ctx);

    // La validación biométrica real la realiza un proceso externo. Solo avanzamos
    // la state machine a password_pending. El `sub` (GUID del usuario) se expone
    // recién aquí, en el último paso que ejecuta este orquestador.
    const updated = await this.sessionServiceClient.advanceStep(req.sessionHandle, {
      fromStep: 'face_pending',
      toStep: 'password_pending',
    }, req.ctx.correlationId);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Onboarding] face step OK -> password_pending');
    return { step: updated.step, sub: session.userSub };
  }

  async verifyOcr(req: VerifyOcrRequest): Promise<StepAdvancedResponse> {
    await this.fase3Guard(req.sessionToken, req.sessionHandle, 'ocr_pending', req.ctx);

    // La validación de OCR real la realiza un proceso externo. Solo avanzamos la
    // state machine a face_pending.
    const updated = await this.sessionServiceClient.advanceStep(req.sessionHandle, {
      fromStep: 'ocr_pending',
      toStep: 'face_pending',
    }, req.ctx.correlationId);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Onboarding] ocr step OK -> face_pending');
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

    // Scope dinámico según el flujo de la sesión: '{flowType}:steps'
    // (ej. appclient:steps, onboarding:steps). Permite reutilizar este mismo
    // orquestador para distintos flujos de canal sin hardcodear el scope.
    const expectedScope = `${session.flowType}:steps`;
    if (claims.scope !== expectedScope) {
      throw new BusinessError('INVALID_TOKEN', `unexpected scope='${claims.scope}', expected='${expectedScope}'`);
    }

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

  private assertDni(dni: string | undefined): void {
    if (!dni || !/^[0-9]{8}$/.test(dni)) {
      throw new BusinessError('INVALID_DNI');
    }
  }

  private assertPassword(password: string): void {
    if (password.length < 8 || !/[0-9]/.test(password)) {
      throw new BusinessError('INVALID_PASSWORD');
    }
  }

  private async issueSessionToken(sessionHandle: string, channel: string, flowType: string, ctx: RequestContext) {
    try {
      return await this.tokenServiceClient.issueSessionToken({
        sessionHandle,
        channel,
        clientIp: ctx.clientIp,
        correlationId: ctx.correlationId,
        flowType,
      });
    } catch (err) {
      logger.error({ correlationId: ctx.correlationId, err: (err as Error).message }, '[Onboarding] token-service unreachable issuing sessionToken');
      throw err;
    }
  }
}
