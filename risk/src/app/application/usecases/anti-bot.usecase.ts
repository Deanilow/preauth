import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '../../infrastructure/di/tokens';
import { AntiBotInputPort, VerifyAntiBotRequest, VerifyAntiBotResponse } from '../ports/input/anti-bot.input';
import { HCaptchaClient } from 'app/infrastructure/clients/hcaptcha.client';
import { logger } from 'app/infrastructure/logger';

@injectable()
export class AntiBotUseCase implements AntiBotInputPort {
  constructor(
    @inject(DI_TOKENS.HCaptchaClient)
    private readonly hCaptchaClient: HCaptchaClient,
  ) { }

  async verify(req: VerifyAntiBotRequest): Promise<VerifyAntiBotResponse> {
    const result = await this.hCaptchaClient.siteVerify(req.captchaToken, req.clientIp);

    // LOG ESTRUCTURADO: Muestra en consola/Datadog toda la metadata devuelta
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
        // rawResponse: result.rawResponse, // <-- Propaga el payload crudo hacia Risk Engine
      },
    };
  }
}