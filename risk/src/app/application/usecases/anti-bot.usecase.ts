import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '../../infrastructure/di/tokens';
import { AntiBotInputPort, VerifyAntiBotRequest, VerifyAntiBotResponse } from '../ports/input/anti-bot.input';
import { HCaptchaClient } from 'app/infrastructure/clients/hcaptcha.client';
import { ClientConstants } from 'app/infrastructure/clients/client.constants';
import { logger } from 'app/infrastructure/logger';

@injectable()
export class AntiBotUseCase implements AntiBotInputPort {
  constructor(
    @inject(DI_TOKENS.HCaptchaClient)
    private readonly hCaptchaClient: HCaptchaClient,
  ) { }

  async verify(req: VerifyAntiBotRequest): Promise<VerifyAntiBotResponse> {
    if (!ClientConstants.hcaptchaSecret) {
      const isForcedFail = req.captchaToken === 'FORCE_FAIL';
      logger.warn(
        { channel: req.channel, forcedFail: isForcedFail },
        '[AntiBot] bypass (HCAPTCHA_SECRET ausente)',
      );
      return {
        verified: !isForcedFail,
        score: isForcedFail ? 0.1 : 0.9,
        provider: 'hcaptcha',
        metadata: { provider: 'hcaptcha', mode: 'bypass' },
      };
    }

    const result = await this.hCaptchaClient.siteVerify(req.captchaToken, req.clientIp);

    logger.info(
      {
        channel: req.channel,
        success: result.success,
        botScore: result.botScore,
        botScoreReason: result.botScoreReason,
        errorCodes: result.errorCodes,
        fullRawResponse: result.rawResponse, // <-- Imprime la respuesta JSON completa para auditar campos nuevos
      },
      '[AntiBot] verify (hCaptcha, live)',
    );

    // score de confianza (1 = humano, 0 = bot)
    const score = result.botScore !== undefined ? 1 - result.botScore : (result.success ? 0.9 : 0.1);

    return {
      verified: result.success,
      score,
      provider: 'hcaptcha',
      metadata: {
        provider: 'hcaptcha',
        mode: 'live',
        hostname: result.hostname,
        challengeTs: result.challengeTs,
        errorCodes: result.errorCodes,
        botScore: result.botScore,
        botScoreReason: result.botScoreReason,
        rawBotScore: result.botScore,
        scoreLevel: result.scoreLevel,
        pass: result.pass,
        // rawResponse: result.rawResponse, // <-- Descomentar para propagar el payload crudo al Risk Engine
      },
    };
  }
}