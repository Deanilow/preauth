import { randomBytes } from 'crypto';
import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '../../infrastructure/di/tokens';
import {
  OtpInputPort,
  GenerateOtpRequest,
  GenerateOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '../ports/input/otp.input';
import { JwtVerifierPort } from '../ports/output/jwt-verifier.port';
import { OtpStorePort } from '../ports/output/otp-store.port';
import { SmsSenderPort } from '../ports/output/sms-sender.port';
import { SessionServiceClient } from '../../infrastructure/clients/session-service.client';
import { ClientConstants } from '../../infrastructure/clients/client.constants';
import { SessionTokenClaims } from '../ports/output/contracts/token-service';
import { OTP_MAX_ATTEMPTS } from '../../domain/entities/otp';
import { logger } from 'app/infrastructure/logger';
import { BusinessError } from 'src/shared/errors/integration.error';

const OTP_TTL_SECONDS = 180;
const OTP_LENGTH = 6;

function generateOtpCode(): string {
  return (randomBytes(3).readUIntBE(0, 3) % 1_000_000).toString().padStart(OTP_LENGTH, '0');
}

/**
 * Genera y verifica el código OTP de la sesión. El OTP se guarda en Redis
 * (`otp:{sessionHandle}`) y el envío al celular es SIMULADO (no se integra
 * proveedor real todavía).
 */
@injectable()
export class OtpUseCase implements OtpInputPort {
  constructor(
    @inject(DI_TOKENS.JwtVerifierPort)
    private readonly jwtVerifier: JwtVerifierPort,
    @inject(DI_TOKENS.OtpStorePort)
    private readonly otpStore: OtpStorePort,
    @inject(DI_TOKENS.SmsSenderPort)
    private readonly smsSender: SmsSenderPort,
    @inject(DI_TOKENS.SessionServiceClient)
    private readonly sessionServiceClient: SessionServiceClient,
  ) { }

  async generate(req: GenerateOtpRequest): Promise<GenerateOtpResponse> {
    await this.assertTokenAndStep(req.sessionToken, req.sessionHandle);

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

    // Sobrescribe el OTP anterior (reenvío) y resetea intentos: la sesión sigue en
    // otp_pending, por lo que reenviar no rompe el flujo.
    await this.otpStore.save(
      req.sessionHandle,
      { sessionHandle: req.sessionHandle, code, expiresAt, attempts: 0 },
      OTP_TTL_SECONDS,
    );

    // Envío SIMULADO: solo se registra, no se contacta ningún proveedor.
    await this.smsSender.send(req.sessionHandle, code);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Messenger] otp generated (sms simulated)');

    return { sessionHandle: req.sessionHandle, expiresIn: OTP_TTL_SECONDS };
  }

  async verify(req: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    await this.assertTokenAndStep(req.sessionToken, req.sessionHandle);

    const record = await this.otpStore.find(req.sessionHandle);
    if (!record) {
      throw new BusinessError('OTP_EXPIRED');
    }

    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      throw new BusinessError('OTP_EXPIRED');
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BusinessError('OTP_MAX_ATTEMPTS');
    }

    const valid = record.code === req.otpCode;

    if (!valid) {
      record.attempts += 1;
      const remainingTtl = Math.max(1, Math.floor((new Date(record.expiresAt).getTime() - Date.now()) / 1000));
      await this.otpStore.save(req.sessionHandle, record, remainingTtl);
      throw new BusinessError('INVALID_OTP');
    }

    // Código correcto: se consume (se elimina para evitar reuso).
    await this.otpStore.delete(req.sessionHandle);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Messenger] otp verified OK');

    return { valid: true };
  }

  /**
   * Valida la firma/scope/sub del sessionToken y que la sesión esté en otp_pending.
   * - Firma RS256 contra el JWKS de token-service.
   * - scope === '{flowType}:steps' (según el flujo de la sesión).
   * - sub === 'session:{sessionHandle}'.
   * - session.step === 'otp_pending' (consultando a session-service).
   */
  private async assertTokenAndStep(sessionToken: string, sessionHandle: string): Promise<void> {
    const claims = await this.jwtVerifier.verify<SessionTokenClaims>(
      sessionToken,
      ClientConstants.expectedSessionTokenAud,
    );

    const session = await this.sessionServiceClient.getSession(sessionHandle, ClientConstants.expectedSessionTokenAud);

    if (claims.sub !== `session:${sessionHandle}`) {
      throw new BusinessError('INVALID_TOKEN', 'sessionToken does not match sessionHandle');
    }

    const expectedScope = `${session.flowType}:steps`;
    if (claims.scope !== expectedScope) {
      throw new BusinessError('INVALID_TOKEN', `unexpected scope='${claims.scope}', expected='${expectedScope}'`);
    }

    if (session.step !== 'otp_pending') {
      throw new BusinessError('STEP_MISMATCH', `session is at '${session.step}', expected 'otp_pending'`);
    }
  }
}
