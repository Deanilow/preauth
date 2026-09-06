import { inject, injectable } from 'tsyringe';
import { FastifyReply, FastifyRequest } from 'fastify';
import { DI_TOKENS } from '../../../infrastructure/di/tokens';
import { AntiBotInputPort } from '../../../application/ports/input/anti-bot.input';
import { Channel } from '../../../domain/entities/channel';

interface VerifyAntiBotBody {
  channel: Channel;
  captchaToken: string;
  clientIp?: string;
}

@injectable()
export class AntiBotController {
  constructor(
    @inject(DI_TOKENS.AntiBotInputPort)
    private readonly antiBotUseCase: AntiBotInputPort,
  ) { }

  async verify(
    req: FastifyRequest<{ Body: VerifyAntiBotBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await this.antiBotUseCase.verify({
      channel: req.body.channel,
      captchaToken: req.body.captchaToken,
      clientIp: req.body.clientIp,
    });

    return reply.send(result);
  }
}
