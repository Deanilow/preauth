import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { container } from '../../app/infrastructure/di/container';
import { DI_TOKENS } from '../../app/infrastructure/di/tokens';
import { SessionController } from 'app/presentation/http/controllers/session.controller';
import {
  createSessionSchema,
  getSessionSchema,
  getSessionByUserSubSchema,
  advanceStepSchema,
  invalidateSessionSchema,
  verifyOtpSchema,
} from 'app/presentation/http/schema/session.schema';
import { serviceApiKeyPreHandler } from 'app/presentation/http/middleware/service-api-key';

const sessionController = container.resolve<SessionController>(DI_TOKENS.SessionController);
const serviceApiKeyPreHandlerInstance = serviceApiKeyPreHandler();

const routerSessions: FastifyPluginCallback = (app: FastifyInstance, _options, done) => {
  app.route({
    method: 'POST',
    url: '/sessions',
    preHandler: [serviceApiKeyPreHandlerInstance],
    schema: createSessionSchema,
    handler: sessionController.createSession.bind(sessionController),
  });

  app.route({
    method: 'GET',
    url: '/sessions/:sessionHandle',
    preHandler: [serviceApiKeyPreHandlerInstance],
    schema: getSessionSchema,
    handler: sessionController.getSession.bind(sessionController),
  });

  app.route({
    method: 'GET',
    url: '/sessions/by-sub/:userSub',
    preHandler: [serviceApiKeyPreHandlerInstance],
    schema: getSessionByUserSubSchema,
    handler: sessionController.getSessionByUserSub.bind(sessionController),
  });

  app.route({
    method: 'PUT',
    url: '/sessions/:sessionHandle/advance',
    preHandler: [serviceApiKeyPreHandlerInstance],
    schema: advanceStepSchema,
    handler: sessionController.advanceStep.bind(sessionController),
  });

  app.route({
    method: 'DELETE',
    url: '/sessions/:sessionHandle/invalidate',
    preHandler: [serviceApiKeyPreHandlerInstance],
    schema: invalidateSessionSchema,
    handler: sessionController.invalidateSession.bind(sessionController),
  });

  app.route({
    method: 'POST',
    url: '/sessions/:sessionHandle/verify-otp',
    preHandler: [serviceApiKeyPreHandlerInstance],
    schema: verifyOtpSchema,
    handler: sessionController.verifyOtp.bind(sessionController),
  });

  done();
};

export default routerSessions;
