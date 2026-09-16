import { FastifyRequest } from 'fastify';
import { injectable, inject } from 'tsyringe';
import { PreAuthInputPort } from '../../../application/ports/input/pre-auth.input';
import { ContextInitBodyDto, ContextInitResponseDto } from '../dto/pre-auth.dto';

@injectable()
export class PreAuthController {
  constructor(
    @inject('PreAuthInputPort')
    private readonly preAuthUseCase: PreAuthInputPort
  ) { }

  async contextInit(
    req: FastifyRequest<{ Body: ContextInitBodyDto }>
  ): Promise<ContextInitResponseDto> {
    const correlationId = (req as FastifyRequest & { correlationId: string }).correlationId;

    const body = req.body;
    const clientIp = req.ip ?? '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) ?? 'unknown';

    return await this.preAuthUseCase.contextInit({
      flowType: body.flowType,
      channel: body.channel,
      context: body.context,
      clientIp,
      userAgent,
      correlationId,
    });
  }
}
