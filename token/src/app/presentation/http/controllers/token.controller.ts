import { inject, injectable } from 'tsyringe';
import { FastifyReply, FastifyRequest } from 'fastify';
import { DI_TOKENS } from '../../../infrastructure/di/tokens';
import { TokenInputPort } from '../../../application/ports/input/token.input';
import { Channel } from '../../../domain/entities/channel';

interface EmitContextTokenBody {
  channel: Channel;
  clientIp: string;
  correlationId: string;
}

interface EmitSessionTokenBody {
  sessionHandle: string;
  channel: Channel;
  clientIp: string;
  correlationId: string;
  flowType: string;
}

@injectable()
export class TokenController {
  constructor(
    @inject(DI_TOKENS.TokenInputPort)
    private readonly tokenUseCase: TokenInputPort,
  ) { }

  async emitContextToken(
    req: FastifyRequest<{ Body: EmitContextTokenBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await this.tokenUseCase.emitContextToken(req.body);
    return reply.send(result);
  }

  async emitSessionToken(
    req: FastifyRequest<{ Body: EmitSessionTokenBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await this.tokenUseCase.emitSessionToken(req.body);
    return reply.send(result);
  }

  async getJwks(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
    return reply.send(this.tokenUseCase.getJwks());
  }
}
