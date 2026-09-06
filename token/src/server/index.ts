
import 'dotenv/config';
import 'reflect-metadata';

import { validateEnvironment } from '../config/env.config';

validateEnvironment();

import {
  fastify,
  type FastifyRequest,
  type FastifyServerOptions,
  type FastifyInstance,
} from 'fastify';

import fastifyConfig from '../config/fastify.config';

import { safeJsonParse } from '../shared/utils/object.utils';
import { logger, pinoConfigOptions } from '../app/infrastructure/logger';

import {
  DEFAULT_ERROR_CODE,
  DEFAULT_ERROR_MESSAGE,
  type ErrorResponse,
  normalizeContractStatusCode,
  normalizeToErrorsResponse,
} from '../shared/errors/errorNormalizer';

const routes = require('../routers');

/**
 * Construye la instancia de Fastify.
 */
const buildServer = async (
  options: FastifyServerOptions,
): Promise<FastifyInstance> => {
  const app = fastify({
    ...options,
  });

  /**
   * Parser para application/merge-patch+json
   */
  app.addContentTypeParser(
    'application/merge-patch+json',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        const json = JSON.parse(body as string);

        done(null, json);
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );

  return app;
};

/**
 * Registra los manejadores globales de error.
 *
 * setNotFoundHandler:
 *   HTTP 404 cuando la ruta no existe.
 *
 * setErrorHandler:
 *   Captura errores lanzados desde controllers,
 *   usecases, servicios, clientes externos, etc.
 */
function attachErrorHandlers(
  app: FastifyInstance,
) {
  /**
   * 404 - Ruta no encontrada
   */
  app.setNotFoundHandler(
    async (
      req: FastifyRequest,
      reply,
    ) => {
      const body: ErrorResponse = {
        errors: [
          {
            code: DEFAULT_ERROR_CODE,
            message: DEFAULT_ERROR_MESSAGE,
            level: 'error',
            description: JSON.stringify({
              request: {
                path: req.url,
              },
              integration: {
                status: 404,
              },
            }),
          },
        ],
      };

      logger.warn(
        {
          requestId: req.headers['x-request-id'],
          path: req.url,
          method: req.method,
          statusCode: 404,
        },
        '[ErrorHandler] 404 Not Found',
      );

      return reply
        .status(404)
        .send(body);
    },
  );

  /**
   * Error handler global
   */
  app.setErrorHandler(
    async (
      error: any,
      req,
      reply,
    ) => {
      const rawStatusCode =
        typeof error?.statusCode === 'number' &&
          error.statusCode >= 400
          ? error.statusCode
          : typeof (error as any)?.status === 'number' &&
            (error as any).status >= 400
            ? (error as any).status
            : 500;

      const statusCode =
        normalizeContractStatusCode(
          rawStatusCode,
        );

      /**
       * Intentar obtener información
       * proveniente de servicios externos.
       */
      const upstreamRaw =
        (error as any)?.body ??
        (error as any)?.externalError ??
        (error as any)?.detail ??
        (error as any)?.responseBody ??
        (error as any)?.response?.data;

      const upstream =
        safeJsonParse(upstreamRaw);

      logger.warn(
        {
          requestId:
            req.headers['x-request-id'],
          path: req.url,
          method: req.method,
          statusCode,
          message: error?.message,
          ...(upstream !== undefined
            ? { upstream }
            : {}),
        },
        '[ErrorHandler] request error — [sur-appcli-customer-account-position-api]',
      );

      /**
       * Normalizar el error al contrato
       * estándar de la aplicación.
       */
      const body =
        normalizeToErrorsResponse({
          req,
          statusCode,
          err: error,
          upstream,
        });

      return reply
        .status(statusCode)
        .send(body);
    },
  );
}

/**
 * Inicializa la aplicación.
 */
async function initializeApp() {
  try {
    /**
     * 1. Crear servidor Fastify
     */
    const app = await buildServer({
      logger: pinoConfigOptions,
    });

    /**
     * 2. Registrar rutas
     *
     * routers/index.ts exporta un array:
     *
     * [
     *   {
     *     route: routerOnboarding,
     *     prefix: '/onboarding'
     *   }
     * ]
     *
     * Por eso no se puede hacer:
     *
     * await app.register(routes);
     *
     * Fastify espera un plugin, no un array.
     */
    for (const item of routes) {
      await app.register(
        item.route,
        {
          prefix: item.prefix,
        },
      );
    }

    /**
     * 3. Registrar handlers globales
     */
    attachErrorHandlers(app);

    /**
     * 4. Iniciar servidor
     */
    await app.listen(fastifyConfig);

    logger.info(
      'Server listening — [sur-appcli-customer-account-position-api]',
    );

    return app;
  } catch (error) {
    logger.error(
      {
        err: error,
      },
      '[server] failed to start — [sur-appcli-customer-account-position-api]',
    );

    process.exit(1);
  }
}

export {
  initializeApp,
};

if (require.main === module) {
  initializeApp();
}
