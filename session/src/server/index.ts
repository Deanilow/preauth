import 'dotenv/config';
import 'reflect-metadata';

import { validateEnvironment } from '../config/env.config';

validateEnvironment();

import {
  fastify,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';

import fastifyConfig from '../config/fastify.config';

import { safeJsonParse } from '../shared/utils/object.utils';

import {
  DEFAULT_ERROR_CODE,
  DEFAULT_ERROR_MESSAGE,
  ErrorResponse,
  normalizeContractStatusCode,
  normalizeToErrorsResponse,
} from '../shared/errors/errorNormalizer';

import {
  logger,
  pinoConfigOptions,
} from '../app/infrastructure/logger';

const routes = require('../routers');

/**
 * Construye la instancia de Fastify.
 */
const buildServer = async (
  options: FastifyServerOptions,
) => {
  const app = fastify({
    ...options,
  });

  /**
   * Parser para application/merge-patch+json
   */
  app.addContentTypeParser(
    'application/merge-patch+json',
    { parseAs: 'string' },
    function (_req, body, done) {
      try {
        const json = JSON.parse(body as string);

        done(null, json);
      } catch (err) {
        done(
          err as Error,
          undefined,
        );
      }
    },
  );

  return app;
};

/**
 * Registra los manejadores globales de error en Fastify.
 *
 * setNotFoundHandler → HTTP 404 cuando la ruta no existe.
 *
 * setErrorHandler → captura TODOS los errores
 * lanzados en controllers, usecases y clientes.
 */
function attachErrorHandlers(
  app: any,
) {
  /**
   * 404 - Ruta no encontrada
   */
  app.setNotFoundHandler(
    (
      req: FastifyRequest,
      reply: any,
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
          path: req.url,
          method: req.method,
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
    (
      error: any,
      req: FastifyRequest,
      reply: any,
    ) => {
      const rawStatusCode =
        typeof error?.statusCode === 'number' &&
          error.statusCode >= 400
          ? error.statusCode
          : typeof error?.status === 'number' &&
            error.status >= 400
            ? error.status
            : 500;

      const statusCode =
        normalizeContractStatusCode(
          rawStatusCode,
        );

      /**
       * Posibles errores provenientes
       * de servicios externos.
       */
      const upstreamRaw =
        error?.body ??
        error?.externalError ??
        error?.detail ??
        error?.responseBody ??
        error?.response?.data;

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
async function initializeapp() {
  try {
    /**
     * 1. Crear instancia Fastify
     */
    const app = await buildServer({
      logger: pinoConfigOptions,
    });

    /**
     * 2. Registrar las rutas.
     *
     * routers/index devuelve un array:
     *
     * [
     *   {
     *     route: ...,
     *     prefix: '...'
     *   }
     * ]
     *
     * Se mantiene la estructura existente.
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
     * 3. Registrar handlers globales.
     */
    attachErrorHandlers(app);

    /**
     * 4. Levantar servidor.
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
  initializeapp,
};

if (require.main === module) {
  initializeapp();
}