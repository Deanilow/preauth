import { inject, injectable } from 'tsyringe';
import { FastifyReply, FastifyRequest } from 'fastify';
import { DI_TOKENS } from '../../../infrastructure/di/tokens';
import { SessionInputPort } from '../../../application/ports/input/session.input';
import { Channel } from '../../../domain/entities/channel';
import { FlowType, FlowStep, SessionMetadata } from '../../../domain/entities/session-state';

interface CreateSessionBody {
  flowType: FlowType;
  channel: Channel;
  clientIp: string;
  fingerprint: string;
  context?: Record<string, unknown>;
  correlationId: string;
}

interface SessionHandleParams {
  sessionHandle: string;
}

interface UserSubParams {
  userSub: string;
}

interface AdvanceStepBody {
  fromStep: FlowStep;
  toStep: FlowStep;
  metadata?: SessionMetadata;
}

interface VerifyOtpBody {
  otpCode: string;
}

@injectable()
export class SessionController {
  constructor(
    @inject(DI_TOKENS.SessionInputPort)
    private readonly sessionUseCase: SessionInputPort,
  ) { }

  async createSession(
    req: FastifyRequest<{ Body: CreateSessionBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await this.sessionUseCase.createSession(req.body);
    return reply.status(201).send(result);
  }

  async getSession(
    req: FastifyRequest<{ Params: SessionHandleParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await this.sessionUseCase.getSession(req.params.sessionHandle);
    return reply.send(result);
  }

  async getSessionByUserSub(
    req: FastifyRequest<{ Params: UserSubParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await this.sessionUseCase.getSessionByUserSub(req.params.userSub);
    return reply.send(result);
  }

  async advanceStep(
    req: FastifyRequest<{ Params: SessionHandleParams; Body: AdvanceStepBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await this.sessionUseCase.advanceStep(req.params.sessionHandle, req.body);
    return reply.send(result);
  }

  async invalidateSession(
    req: FastifyRequest<{ Params: SessionHandleParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await this.sessionUseCase.invalidateSession(req.params.sessionHandle);
    return reply.status(204).send();
  }

  async verifyOtp(
    req: FastifyRequest<{ Params: SessionHandleParams; Body: VerifyOtpBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await this.sessionUseCase.verifyOtp(req.params.sessionHandle, req.body.otpCode);
    return reply.send(result);
  }
}
