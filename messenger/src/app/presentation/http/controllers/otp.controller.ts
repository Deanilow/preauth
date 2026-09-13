import { FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '../../../infrastructure/di/tokens';
import { OtpInputPort } from '../../../application/ports/input/otp.input';
import { GenerateOtpBodyDto, GenerateOtpResponseDto, VerifyOtpBodyDto, VerifyOtpResponseDto } from '../dto/otp.dto';

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
export class OtpController {
  constructor(
    @inject(DI_TOKENS.OtpInputPort)
    private readonly otpUseCase: OtpInputPort,
  ) { }

  private correlationId(req: FastifyRequest): string {
    return (req as ReqWithCorrelation).correlationId;
  }

  async generate(req: FastifyRequest<{ Body: GenerateOtpBodyDto }>): Promise<GenerateOtpResponseDto> {
    const sessionToken = extractBearerToken(req.headers.authorization);
    return this.otpUseCase.generate({
      sessionToken,
      sessionHandle: req.body.sessionHandle,
      ctx: { correlationId: this.correlationId(req) },
    });
  }

  async verify(req: FastifyRequest<{ Body: VerifyOtpBodyDto }>): Promise<VerifyOtpResponseDto> {
    const sessionToken = extractBearerToken(req.headers.authorization);
    return this.otpUseCase.verify({
      sessionToken,
      sessionHandle: req.body.sessionHandle,
      otpCode: req.body.otpCode,
      ctx: { correlationId: this.correlationId(req) },
    });
  }
}
