import { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { ClientConstants } from 'app/infrastructure/clients/client.constants';
import { BusinessError } from 'src/shared/errors/integration.error';

/**
 * Autenticacion service-to-service (no JWT): compara el header Authorization contra
 * un API key estatica compartida con los llamadores autorizados (ej. preauth-orchestrator).
 */
export function serviceApiKeyPreHandler(): preHandlerAsyncHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = (req.headers.authorization ?? req.headers.Authorization) as string | undefined;
    const expected = `Bearer ${ClientConstants.serviceApiKey}`;

    if (authHeader !== expected) {
      throw new BusinessError('UNAUTHORIZED_SERVICE_CALL');
    }
  };
}