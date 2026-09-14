import 'dotenv/config';
import 'reflect-metadata';

import { validateEnvironment } from '../config/env.config';

validateEnvironment();

import {
  fastify,
  type FastifyInstance,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';

import { safeJsonParse } from '../shared/utils/object.utils';
import {
  ErrorItem,
  ErrorResponse,
} from '../shared/types/wrapper';

import {
  logger,
  pinoConfigOptions,
} from '../app/infrastructure/logger';

import fastifyConfig from '../config/fastify.config';
import { buildErrorWrapper } from '../shared/errors/integration.error';

const routes = require('../routers/index');

export const DEFAULT_ERROR_MESSAGE =
  'Se presentado un error durante el procesamiento de la solicitud - [sur-appcli-internal-transfer-api]';

export const DEFAULT_ERROR_CODE =
  'internal-transfer-api';

/**
 * Construye la instancia Fastify.
 */
const buildServer = async (
  options: FastifyServerOptions,
): Promise<FastifyInstance> => {
  const app = fastify({
    ...options,
  });

  /**
   * Content-Type:
   * application/merge-patch+json
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
 * Determina si la respuesta tiene el formato
 * de error utilizado por la aplicación.
 */
function isWrappedErrorPayload(
  payload: unknown,
): payload is {
  status: number;
  error: ErrorItem;
} {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'status' in payload &&
    typeof (payload as { status?: unknown }).status === 'number' &&
    'error' in payload &&
    typeof (payload as { error?: unknown }).error === 'object'
  );
}

/**
 * Normaliza respuestas que vienen con:
 *
 * {
 *   status: 400,
 *   error: {...}
 * }
 *
 * a:
 *
 * {
 *   error: {...}
 * }
 *
 * manteniendo el HTTP status.
 */
function attachResponseNormalizer(
  app: FastifyInstance,
) {
  app.addHook(
    'onSend',
    async (
      _request,
      reply,
      payload,
    ) => {
      let parsedPayload: unknown = payload;

      if (typeof payload === 'string') {
        const maybeJson = safeJsonParse(payload);

        if (
          typeof maybeJson === 'object' &&
          maybeJson !== null
        ) {
          parsedPayload = maybeJson;
        }
      }

      if (!isWrappedErrorPayload(parsedPayload)) {
        return payload;
      }

      reply.status(parsedPayload.status);

      return JSON.stringify({
        error: parsedPayload.error,
      });
    },
  );
}

/**
 * Error handlers globales.
 */
function attachErrorHandlers(
  app: FastifyInstance,
) {
  /**
   * 404
   */
  app.setNotFoundHandler(
    async (
      req: FastifyRequest,
      reply,
    ) => {
      const body: ErrorResponse = {
        error: {
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
      };

      logger.warn(
        {
          requestId:
            req.headers['x-request-id'],
          path: req.url,
          method: req.method,
          statusCode: 404,
        },
        '[ErrorHandler] 404 Not Found - [sur-appcli-internal-transfer-api]',
      );

      return reply
        .status(404)
        .send(body);
    },
  );

  /**
   * Errores no controlados.
   */
  app.setErrorHandler(
    async (
      error,
      req,
      reply,
    ) => {
      const wrapped =
        await buildErrorWrapper(error);

      return reply
        .status(wrapped.status)
        .send({
          error: wrapped.error,
        });
    },
  );
}

/**
 * Graceful shutdown.
 */
function attachGracefulShutdown(
  app: FastifyInstance,
) {
  let isShuttingDown = false;

  const shutdown = async (
    signal: string,
  ) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;

    logger.info(
      `[Shutdown] ${signal} received, starting graceful shutdown...`,
    );

    const forceExitTimeout =
      setTimeout(() => {
        logger.error(
          '[Shutdown] Timeout exceeded (10s), forcing exit',
        );

        process.exit(1);
      }, 10_000);

    forceExitTimeout.unref();

    try {
      await app.close();

      clearTimeout(forceExitTimeout);

      logger.info(
        '[Shutdown] Graceful shutdown complete',
      );

      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimeout);

      logger.error(
        { err: error },
        '[Shutdown] Error during shutdown',
      );

      process.exit(1);
    }
  };

  process.once(
    'SIGTERM',
    () => shutdown('SIGTERM'),
  );

  process.once(
    'SIGINT',
    () => shutdown('SIGINT'),
  );
}

/**
 * Inicializa la aplicación.
 */
async function initializeApp() {
  try {
    /**
     * 1. Crear Fastify
     */
    const app = await buildServer({
      logger: pinoConfigOptions,
    });

    /**
     * 2. Registrar las rutas existentes.
     *
     * routers/index devuelve un array:
     *
     * [
     *   {
     *     route: routerOnboarding,
     *     prefix: '/onboarding'
     *   }
     * ]
     *
     * Se mantiene la estructura actual
     * y se registra cada ruta en Fastify.
     */
    for (const item of routes) {
      await app.register(item.route, {
        prefix: item.prefix,
      });
    }

    /**
     * 3. Normalizador de respuestas
     */
    attachResponseNormalizer(app);

    /**
     * 4. Error handlers
     */
    attachErrorHandlers(app);

    /**
     * 5. Graceful shutdown
     */
    attachGracefulShutdown(app);

    /**
     * 6. Levantar servidor
     */
    await app.listen(fastifyConfig);

    logger.info(
      'Server listening - [sur-appcli-internal-transfer-api]',
    );

    return app;
  } catch (error) {
    logger.error(
      {
        issues: (error as any)?.issues,
        error,
      },
      '[server] Configuracion de variables de entorno no valida - [sur-appcli-internal-transfer-api]',
    );

    process.exit(1);
  }
}

export {
  buildServer,
  initializeApp,
};

if (require.main === module) {
  initializeApp();
}