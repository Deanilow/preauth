import { randomUUID, createHash } from 'crypto';
import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '../../infrastructure/di/tokens';
import { DigitalTokenSignerOutputPort, JwksResult } from '../ports/output/digital-token.port';
import {
  TokenInputPort,
  EmitContextTokenRequest,
  EmitSessionTokenRequest,
  EmitTokenResponse,
} from '../ports/input/token.input';
import { BusinessError } from 'src/shared/errors/integration.error';
import { logger } from 'app/infrastructure/logger';

const CONTEXT_TOKEN_TTL_SECONDS = 120;
const SESSION_TOKEN_TTL_SECONDS = 900;
const ISSUER = 'token-service';
const CONTEXT_TOKEN_AUDIENCE = 'preauth-api';
const SESSION_TOKEN_AUDIENCE = 'onboarding-service';
const CONTEXT_TOKEN_SCOPE = 'preauth:onboarding.start';
const SESSION_TOKEN_SCOPE = 'onboarding.active';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

@injectable()
export class TokenUseCase implements TokenInputPort {
  constructor(
    @inject(DI_TOKENS.DigitalTokenSignerOutputPort)
    private readonly signer: DigitalTokenSignerOutputPort,
  ) { }

  async emitContextToken(req: EmitContextTokenRequest): Promise<EmitTokenResponse> {
    const jti = randomUUID();

    const payload = {
      iss: ISSUER,
      aud: CONTEXT_TOKEN_AUDIENCE,
      scope: CONTEXT_TOKEN_SCOPE,
      channel: req.channel,
      jti,
      fp: sha256(req.fingerprint),
      ipHash: sha256(req.clientIp),
    };

    const token = await this.sign(payload, CONTEXT_TOKEN_TTL_SECONDS);

    logger.info({ correlationId: req.correlationId, jti, channel: req.channel }, '[Token] contextToken emitted');

    return { token, jti, expiresIn: CONTEXT_TOKEN_TTL_SECONDS };
  }

  async emitSessionToken(req: EmitSessionTokenRequest): Promise<EmitTokenResponse> {
    const jti = randomUUID();

    const payload = {
      iss: ISSUER,
      aud: SESSION_TOKEN_AUDIENCE,
      scope: SESSION_TOKEN_SCOPE,
      sub: `session:${req.sessionHandle}`,
      channel: req.channel,
      ipHash: sha256(req.clientIp),
      jti,
    };

    const token = await this.sign(payload, SESSION_TOKEN_TTL_SECONDS);

    logger.info({ correlationId: req.correlationId, jti, sessionHandle: req.sessionHandle }, '[Token] sessionToken emitted');

    return { token, jti, expiresIn: SESSION_TOKEN_TTL_SECONDS };
  }

  getJwks(): JwksResult {
    return this.signer.getJwks();
  }

  private async sign(payload: Record<string, unknown>, expiresInSeconds: number): Promise<string> {
    try {
      return await this.signer.sign(payload, expiresInSeconds);
    } catch (error) {
      throw new BusinessError('TOKEN_GENERATION_FAILED', (error as Error).message);
    }
  }
}
