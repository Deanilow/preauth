import { randomUUID } from 'crypto';
import { container } from '../../app/infrastructure/di/container';
import { FastifyInstance, FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { DI_TOKENS } from '../../app/infrastructure/di/tokens';
import { errorResponseSchema } from '../../shared/schema/errorResponseSchema';
import { OnboardingController } from '../../app/presentation/http/controllers/onboarding.controller';
import { startBodySchema } from '../schemas/onboarding/startBodySchema';
import { verifyOtpBodySchema } from '../schemas/onboarding/verifyOtpBodySchema';
import { verifyFaceBodySchema } from '../schemas/onboarding/verifyFaceBodySchema';
import { verifyOcrBodySchema } from '../schemas/onboarding/verifyOcrBodySchema';
import { selectProductsBodySchema } from '../schemas/onboarding/selectProductsBodySchema';
import { createPasswordBodySchema } from '../schemas/onboarding/createPasswordBodySchema';

const onboardingController = container.resolve<OnboardingController>(DI_TOKENS.OnboardingController);

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
  502: errorResponseSchema,
};

// Orquestador de los pasos de onboarding. Cada paso (salvo /start) requiere el sessionToken
// emitido por token-service (aud=onboarding-service) en el header Authorization, y un
// X-Request-Id unico por intento (anti-replay a nivel de request).
const routerOnboarding: FastifyPluginCallback = (app: FastifyInstance, _options, done) => {
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();
    (req as FastifyRequest & { correlationId: string }).correlationId = correlationId;
    reply.header('x-correlation-id', correlationId);
  });

  app.route({
    method: 'POST',
    url: '/start',
    schema: {
      body: startBodySchema,
      response: { ...commonErrorResponses },
    },
    handler: onboardingController.start.bind(onboardingController),
  });

  app.route({
    method: 'POST',
    url: '/otp',
    schema: {
      body: verifyOtpBodySchema,
      response: { ...commonErrorResponses },
    },
    handler: onboardingController.verifyOtp.bind(onboardingController),
  });

  app.route({
    method: 'POST',
    url: '/face',
    schema: {
      body: verifyFaceBodySchema,
      response: { ...commonErrorResponses },
    },
    handler: onboardingController.verifyFace.bind(onboardingController),
  });

  app.route({
    method: 'POST',
    url: '/ocr',
    schema: {
      body: verifyOcrBodySchema,
      response: { ...commonErrorResponses },
    },
    handler: onboardingController.verifyOcr.bind(onboardingController),
  });

  app.route({
    method: 'POST',
    url: '/products',
    schema: {
      body: selectProductsBodySchema,
      response: { ...commonErrorResponses },
    },
    handler: onboardingController.selectProducts.bind(onboardingController),
  });

  // app.route({
  //   method: 'POST',
  //   url: '/password',
  //   schema: {
  //     body: createPasswordBodySchema,
  //     response: { ...commonErrorResponses },
  //   },
  //   handler: onboardingController.createPassword.bind(onboardingController),
  // });

  done();
};

export default routerOnboarding;
