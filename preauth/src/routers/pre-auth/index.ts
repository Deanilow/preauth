import { randomUUID } from 'crypto';
import { container } from '../../app/infrastructure/di/container';
import { FastifyInstance, FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { DI_TOKENS } from '../../app/infrastructure/di/tokens';
import { errorResponseSchema } from '../schemas/errorResponseSchema';
import { PreAuthController } from '../../app/presentation/http/controllers/pre-auth.controller';
import { contextInitBodySchema } from '../schemas/pre-auth/contextInitBodySchema';

const preAuthController = container.resolve<PreAuthController>(DI_TOKENS.PreAuthController);

const commonErrorResponses = {
  400: errorResponseSchema,
  403: errorResponseSchema,
  429: errorResponseSchema,
  500: errorResponseSchema,
};

// Sin auth propia: es el punto de entrada del flujo, antes de que exista cualquier sesion/token.
// Los errores se resuelven con el buildErrorWrapper global (mismo shape que el resto de la API).
const routerPreAuth: FastifyPluginCallback = (app: FastifyInstance, _options, done) => {
  // x-correlation-id se resuelve una sola vez por request y viaja en el header de la respuesta,
  // tanto en exito como en error (incluye fallos de validacion de schema, previos al controller).
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();
    (req as FastifyRequest & { correlationId: string }).correlationId = correlationId;
    reply.header('x-correlation-id', correlationId);
  });

  app.route({
    method: 'POST',
    url: '/context-init',
    schema: {
      body: contextInitBodySchema,
      response: {
        ...commonErrorResponses,
      },
    },
    handler: preAuthController.contextInit.bind(preAuthController)
  });

  done();
};

export default routerPreAuth;


