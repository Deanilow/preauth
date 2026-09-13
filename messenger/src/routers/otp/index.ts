import { container } from '../../app/infrastructure/di/container';
import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { DI_TOKENS } from '../../app/infrastructure/di/tokens';
import { errorResponseSchema } from '../../shared/schema/errorResponseSchema';
import { OtpController } from '../../app/presentation/http/controllers/otp.controller';
import { generateOtpBodySchema } from '../schemas/otp/generateOtpBodySchema';
import { verifyOtpBodySchema } from '../schemas/otp/verifyOtpBodySchema';

const otpController = container.resolve<OtpController>(DI_TOKENS.OtpController);

const commonErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  410: errorResponseSchema,
  422: errorResponseSchema,
  429: errorResponseSchema,
  500: errorResponseSchema,
};

// Servicio de OTP: genera y verifica el código. Cada endpoint requiere el sessionToken
// (aud=onboarding-service, scope=onboarding:steps) en el header Authorization.
const routerOtp: FastifyPluginCallback = (app: FastifyInstance, _options, done) => {
  app.route({
    method: 'POST',
    url: '/generate',
    schema: {
      body: generateOtpBodySchema,
      response: { ...commonErrorResponses },
    },
    handler: otpController.generate.bind(otpController),
  });

  app.route({
    method: 'POST',
    url: '/verify',
    schema: {
      body: verifyOtpBodySchema,
      response: { ...commonErrorResponses },
    },
    handler: otpController.verify.bind(otpController),
  });

  done();
};

export default routerOtp;
