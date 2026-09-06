import { randomUUID } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '../../../infrastructure/di/tokens';
import { OnboardingInputPort, RequestContext } from '../../../application/ports/input/onboarding.input';
import {
  StartBodyDto,
  StartResponseDto,
  VerifyOtpBodyDto,
  VerifyFaceBodyDto,
  VerifyOcrBodyDto,
  SelectProductsBodyDto,
  CreatePasswordBodyDto,
  StepAdvancedResponseDto,
} from '../dto/onboarding.dto';

type ReqWithCorrelation = FastifyRequest & { correlationId: string };

function extractBearerToken(authHeader?: string): string {
  if (!authHeader) return '';
  const prefix = 'bearer ';
  const trimmed = authHeader.trimStart();
  if (trimmed.length <= prefix.length) return '';
  if (trimmed.substring(0, prefix.length).toLowerCase() !== prefix) return '';
  return trimmed.substring(prefix.length).trim();
}

@injectable()
export class OnboardingController {
  constructor(
    @inject(DI_TOKENS.OnboardingInputPort)
    private readonly onboardingUseCase: OnboardingInputPort,
  ) { }

  private buildContext(req: FastifyRequest): RequestContext {
    return {
      clientIp: req.ip ?? '127.0.0.1',
      userAgent: (req.headers['user-agent'] as string) ?? 'unknown',
      correlationId: (req as ReqWithCorrelation).correlationId,
      requestId: (req.headers['x-request-id'] as string) ?? randomUUID(),
    };
  }

  async start(req: FastifyRequest<{ Body: StartBodyDto }>): Promise<StartResponseDto> {
    const contextToken = extractBearerToken(req.headers.authorization);
    return this.onboardingUseCase.start({
      contextToken,
      sessionHandle: req.body.sessionHandle,
      dni: req.body.dni,
      ctx: this.buildContext(req),
    });
  }

  async verifyOtp(req: FastifyRequest<{ Body: VerifyOtpBodyDto }>): Promise<StepAdvancedResponseDto> {
    const sessionToken = extractBearerToken(req.headers.authorization);
    return this.onboardingUseCase.verifyOtp({
      sessionToken,
      sessionHandle: req.body.sessionHandle,
      otpCode: req.body.otpCode,
      ctx: this.buildContext(req),
    });
  }

  async verifyFace(req: FastifyRequest<{ Body: VerifyFaceBodyDto }>): Promise<StepAdvancedResponseDto> {
    const sessionToken = extractBearerToken(req.headers.authorization);
    return this.onboardingUseCase.verifyFace({
      sessionToken,
      sessionHandle: req.body.sessionHandle,
      faceToken: req.body.faceToken,
      ctx: this.buildContext(req),
    });
  }

  async verifyOcr(req: FastifyRequest<{ Body: VerifyOcrBodyDto }>): Promise<StepAdvancedResponseDto> {
    const sessionToken = extractBearerToken(req.headers.authorization);
    return this.onboardingUseCase.verifyOcr({
      sessionToken,
      sessionHandle: req.body.sessionHandle,
      ocrToken: req.body.ocrToken,
      ctx: this.buildContext(req),
    });
  }

  async selectProducts(req: FastifyRequest<{ Body: SelectProductsBodyDto }>): Promise<StepAdvancedResponseDto> {
    const sessionToken = extractBearerToken(req.headers.authorization);
    return this.onboardingUseCase.selectProducts({
      sessionToken,
      sessionHandle: req.body.sessionHandle,
      productIds: req.body.productIds,
      ctx: this.buildContext(req),
    });
  }

  // async createPassword(req: FastifyRequest<{ Body: CreatePasswordBodyDto }>): Promise<StepAdvancedResponseDto> {
  //   const sessionToken = extractBearerToken(req.headers.authorization);
  //   return this.onboardingUseCase.createPassword({
  //     sessionToken,
  //     sessionHandle: req.body.sessionHandle,
  //     password: req.body.password,
  //     ctx: this.buildContext(req),
  //   });
  // }
}

// FastifyReply is unused directly (handlers return the body, composer serializes it)
// but kept imported for typing consistency with other controllers in the workspace.
export type { FastifyReply };
