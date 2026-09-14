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
import { OtpProviderPort } from '../ports/output/otp-provider.port';
import { SessionServiceClient } from '../../infrastructure/clients/session-service.client';
import { ClientConstants } from '../../infrastructure/clients/client.constants';
import { SessionTokenClaims } from '../ports/output/contracts/token-service';
import { logger } from 'app/infrastructure/logger';
import { BusinessError } from 'src/shared/errors/integration.error';

const OTP_TTL_SECONDS = 180;

/**
 * Caso de uso del servicio de OTP. Este servicio NO genera ni valida el código
 * real: valida el token/paso y DELEGA la generación/verificación al "otro
 * servicio" (OtpProviderPort). No persiste nada en Redis.
 */
@injectable()
export class OtpUseCase implements OtpInputPort {
  constructor(
    @inject(DI_TOKENS.JwtVerifierPort)
    private readonly jwtVerifier: JwtVerifierPort,
    @inject(DI_TOKENS.OtpProviderPort)
    private readonly otpProvider: OtpProviderPort,
    @inject(DI_TOKENS.SessionServiceClient)
    private readonly sessionServiceClient: SessionServiceClient,
  ) { }

  async generate(req: GenerateOtpRequest): Promise<GenerateOtpResponse> {
    await this.assertTokenAndStep(req.sessionToken, req.sessionHandle);

    // Delega la generación (y envío) del OTP al otro servicio.
    await this.otpProvider.generate(req.sessionHandle);

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Messenger] otp generate delegado');

    return { sessionHandle: req.sessionHandle, expiresIn: OTP_TTL_SECONDS };
  }

  async verify(req: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    await this.assertTokenAndStep(req.sessionToken, req.sessionHandle);

    // Delega la verificación del OTP al otro servicio.
    const valid = await this.otpProvider.verify(req.sessionHandle, req.otpCode);

    if (!valid) {
      throw new BusinessError('INVALID_OTP');
    }

    logger.info({ correlationId: req.ctx.correlationId, sessionHandle: req.sessionHandle }, '[Messenger] otp verify OK');

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
