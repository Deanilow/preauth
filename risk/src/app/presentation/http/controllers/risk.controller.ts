import { inject, injectable } from 'tsyringe';
import { FastifyReply, FastifyRequest } from 'fastify';
import { DI_TOKENS } from '../../../infrastructure/di/tokens';
import { RiskInputPort } from '../../../application/ports/input/risk.input';
import { Channel } from '../../../domain/entities/channel';
import { RiskDecision } from '../../../domain/entities/risk-decision';

interface EvaluateRiskBody {
  clientIp: string;
  fingerprint: string;
  userAgent: string;
  channel: Channel;
  antiBotScore: number;
  correlationId: string;
  forceDecision?: RiskDecision;
}

@injectable()
export class RiskController {
  constructor(
    @inject(DI_TOKENS.RiskInputPort)
    private readonly riskUseCase: RiskInputPort,
  ) { }

  async evaluate(
    req: FastifyRequest<{ Body: EvaluateRiskBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await this.riskUseCase.evaluate(req.body);

    return reply.send(result);
  }
}
