import 'dotenv/config';
import 'reflect-metadata';
import dns from 'dns';

import { validateEnvironment } from '../config/env.config';

dns.setDefaultResultOrder('ipv4first');

validateEnvironment();

import {
  fastify,
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

const routes = require('../routers');

export const DEFAULT_ERROR_MESSAGE =
  'Se presentado un error durante el procesamiento de la solicitud - [sur-appcli-internal-transfer-api]';

export const DEFAULT_ERROR_CODE =
  'internal-transfer-api';

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
    function (
      _req,
      body,
      done,
    ) {
      try {
        const json = JSON.parse(
          body as string,
        );

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
 * Verifica si el payload corresponde
 * al formato de error envuelto.
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
    typeof (
      payload as {
        status?: unknown;
      }
    ).status === 'number' &&
    'error' in payload &&
    typeof (
      payload as {
        error?: unknown;
      }
    ).error === 'object'
  );
}

/**
 * Normaliza respuestas de error.
 *
 * Convierte:
 *
 * {
 *   status: 400,
 *   error: {...}
 * }
 *
 * en:
 *
 * {
 *   error: {...}
 * }
 */
function attachResponseNormalizer(
  app: any,
) {
  app.addHook(
    'onSend',
    async (
      _request: any,
      reply: any,
      payload: unknown,
    ) => {
      let parsedPayload = payload;

      if (typeof payload === 'string') {
        const maybeJson =
          safeJsonParse(payload);

        if (
          typeof maybeJson === 'object' &&
          maybeJson !== null
        ) {
          parsedPayload = maybeJson;
        }
      }

      if (
        !isWrappedErrorPayload(
          parsedPayload,
        )
      ) {
        return payload;
      }

      reply.status(
        parsedPayload.status,
      );

      return JSON.stringify({
        error: parsedPayload.error,
      });
    },
  );
}

/**
 * Registra los manejadores globales
 * de errores en Fastify.
 */
function attachErrorHandlers(
  app: any,
) {
  /**
   * 404 - Ruta no encontrada.
   */
  app.setNotFoundHandler(
    (
      req: FastifyRequest,
      reply: any,
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
        '[ErrorHandler] 404 Not Found',
      );

      return reply
        .status(404)
        .send(body);
    },
  );

  /**
   * Error handler global.
   */
  app.setErrorHandler(
    async (
      error: any,
      req: FastifyRequest,
      reply: any,
    ) => {
      logger.warn(
        {
          requestId:
            req.headers['x-request-id'],
          path: req.url,
          method: req.method,
          errorName: error?.name,
          errorCode: error?.code,
          message: error?.message,
        },
        '[ErrorHandler] Unhandled error - [sur-appcli-customer-loan-api]',
      );

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
 * Graceful Shutdown.
 */
function attachGracefulShutdown(
  app: any,
) {
  /**
   * Hook de Fastify ejecutado
   * cuando se llama app.close().
   */
  app.addHook(
    'onClose',
    async () => {
      logger.info(
        '[Shutdown] Closing pool...',
      );

      /**
       * Si posteriormente tienes un pool
       * real de PostgreSQL, aquí puedes
       * ejecutar:
       *
       * await pool.end();
       */
      logger.info(
        '[Shutdown] Database pool closed',
      );
    },
  );

  /**
   * Evitar múltiples ejecuciones
   * de shutdown.
   */
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

    /**
     * Timeout de seguridad.
     *
     * Si app.close() se queda bloqueado,
     * se fuerza la salida después de 10 segundos.
     */
    const forceExitTimeout =
      setTimeout(() => {
        logger.error(
          '[Shutdown] Timeout exceeded (10s), forcing exit',
        );

        process.exit(1);
      }, 10_000);

    /**
     * El timer no mantiene vivo
     * el event loop.
     */
    if (
      typeof forceExitTimeout.unref ===
      'function'
    ) {
      forceExitTimeout.unref();
    }

    try {
      /**
       * Fastify:
       *
       * 1. Deja de aceptar nuevas conexiones.
       * 2. Espera requests en vuelo.
       * 3. Ejecuta hooks onClose.
       * 4. Cierra plugins/conexiones.
       */
      await app.close();

      logger.info(
        '[Shutdown] Graceful shutdown complete',
      );

      process.exit(0);
    } catch (err) {
      logger.error(
        { err },
        '[Shutdown] Error during shutdown',
      );

      process.exit(1);
    }
  };

  /**
   * SIGTERM:
   * Docker / Kubernetes / Azure, etc.
   */
  process.once(
    'SIGTERM',
    () => shutdown('SIGTERM'),
  );

  /**
   * SIGINT:
   * Ctrl + C.
   */
  process.once(
    'SIGINT',
    () => shutdown('SIGINT'),
  );
}

/**
 * Inicializa la aplicación.
 */
async function initializeapp() {
  try {
    /**
     * 1. Crear instancia Fastify.
     */
    const app = await buildServer({
      logger: pinoConfigOptions,
    });

    /**
     * 2. Registrar rutas.
     *
     * ../routers exporta un array:
     *
     * [
     *   {
     *     route: router,
     *     prefix: '/...'
     *   }
     * ]
     *
     * Cada router se registra
     * individualmente en Fastify.
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
     * 3. Normalizador de respuestas.
     */
    attachResponseNormalizer(app);

    /**
     * 4. Error handlers.
     */
    attachErrorHandlers(app);

    /**
     * 5. Graceful shutdown.
     */
    attachGracefulShutdown(app);

    /**
     * 6. Levantar servidor.
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
  initializeapp,
};

if (require.main === module) {
  initializeapp();
}
