import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { container } from '../../app/infrastructure/di/container';
import { DI_TOKENS } from '../../app/infrastructure/di/tokens';
import { TokenController } from 'app/presentation/http/controllers/token.controller';
import { emitContextTokenSchema, emitSessionTokenSchema, getJwksSchema } from 'app/presentation/http/schema/token.schema';
import { serviceApiKeyPreHandler } from 'app/presentation/http/middleware/service-api-key';

const tokenController = container.resolve<TokenController>(DI_TOKENS.TokenController);
const serviceApiKeyPreHandlerInstance = serviceApiKeyPreHandler();

const routerTokens: FastifyPluginCallback = (app: FastifyInstance, _options, done) => {
  app.route({
    method: 'POST',
    url: '/tokens/context',
    preHandler: [serviceApiKeyPreHandlerInstance],
    schema: emitContextTokenSchema,
    handler: tokenController.emitContextToken.bind(tokenController),
  });

  app.route({
    method: 'POST',
    url: '/tokens/session',
    preHandler: [serviceApiKeyPreHandlerInstance],
    schema: emitSessionTokenSchema,
    handler: tokenController.emitSessionToken.bind(tokenController),
  });

  app.route({
    method: 'GET',
    url: '/jwks',
    schema: getJwksSchema,
    handler: tokenController.getJwks.bind(tokenController),
  });

  done();
};

export default routerTokens;
