import { inject, injectable } from 'tsyringe';
import { PreAuthInputPort } from '../ports/input/pre-auth.input';
import { ContextInitRequest } from '../ports/input/pre-auth.request';
import { ContextInitResponse } from '../ports/input/pre-auth.response';
import { AntiBotVerifyResponse } from '../ports/output/contracts/anti-bot';
import { RiskEvaluateResponse } from '../ports/output/contracts/risk-engine';
import { logger } from 'app/infrastructure/logger';
import { AntiBotClient } from 'app/infrastructure/clients/anti-bot.client';
import { RiskEngineClient } from 'app/infrastructure/clients/risk-engine.client';
import { TokenServiceClient } from 'app/infrastructure/clients/token-service.client';
import { SessionServiceClient } from 'app/infrastructure/clients/session-service.client';
import { BusinessError } from 'src/shared/errors/integration.error';

@injectable()
export class PreAuthUseCase implements PreAuthInputPort {
  constructor(
    @inject('AntiBotClient')
    private readonly antiBotClient: AntiBotClient,
    @inject('RiskEngineClient')
    private readonly riskEngineClient: RiskEngineClient,
    @inject('TokenServiceClient')
    private readonly tokenServiceClient: TokenServiceClient,
    @inject('SessionServiceClient')
    private readonly sessionServiceClient: SessionServiceClient,
  ) { }

  async contextInit(req: ContextInitRequest): Promise<ContextInitResponse> {
    const antiBot = await this.verifyAntiBot(req);
    const risk = await this.evaluateRisk(req, antiBot);
    return this.issueContext(req, risk);
  }

  private async verifyAntiBot(req: ContextInitRequest): Promise<AntiBotVerifyResponse> {
    const result = await this.antiBotClient.verify({ channel: req.channel, captchaToken: req.captchaToken, clientIp: req.clientIp });

    if (!result.verified) {
      logger.warn({ correlationId: req.correlationId }, '[PreAuth] bot_detected');
      throw new BusinessError('BOT_DETECTED');
    }

    return result;
  }

  private async evaluateRisk(req: ContextInitRequest, antiBot: AntiBotVerifyResponse): Promise<RiskEvaluateResponse> {
    const result = await this.riskEngineClient.evaluate({
      clientIp: req.clientIp,
      fingerprint: req.fingerprint,
      userAgent: req.userAgent,
      channel: req.channel,
      antiBotScore: antiBot.score,
      antiBotMetadata: antiBot.metadata,
      correlationId: req.correlationId,
    });

    if (result.decision === 'deny') {
      throw new BusinessError('RISK_DENIED');
    }
    if (result.decision === 'challenge') {
      throw new BusinessError('CHALLENGE_REQUIRED');
    }

    return result;
  }

  private async issueContext(req: ContextInitRequest, _risk: RiskEvaluateResponse): Promise<ContextInitResponse> {
    const [tokenBody, sessionBody] = await Promise.all([
      this.tokenServiceClient.issueContextToken({
        channel: req.channel,
        fingerprint: req.fingerprint,
        clientIp: req.clientIp,
        correlationId: req.correlationId,
      }),
      this.sessionServiceClient.createSession({
        channel: req.channel,
        clientIp: req.clientIp,
        fingerprint: req.fingerprint,
        correlationId: req.correlationId,
      }),
    ]);

    logger.info({ correlationId: req.correlationId, sessionHandle: sessionBody.sessionHandle }, '[PreAuth] context-init OK');

    return {
      contextToken: tokenBody.token,
      sessionHandle: sessionBody.sessionHandle,
      expiresIn: tokenBody.expiresIn,
    };
  }
}
