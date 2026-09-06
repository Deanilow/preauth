import 'dotenv/config';
import 'reflect-metadata';

import {
  fastify,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';

import { validateEnvironment } from '../config/env.config';
import fastifyConfig from '../config/fastify.config';

import { safeJsonParse } from '../shared/utils/object.utils';
import {
  DEFAULT_ERROR_CODE,
  DEFAULT_ERROR_MESSAGE,
  type ErrorResponse,
  normalizeContractStatusCode,
  normalizeToErrorsResponse,
} from '../shared/errors/errorNormalizer';

import {
  logger,
  pinoConfigOptions,
} from '../app/infrastructure/logger';

const routes = require('../routers');

validateEnvironment();

const buildServer = async (
  options: FastifyServerOptions = {},
) => {
  const app = fastify({
    ...options,
  });

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
 * Registra los manejadores globales de error en Fastify.
 *
 * setNotFoundHandler → HTTP 404 cuando la ruta no existe.
 *
 * setErrorHandler → captura errores lanzados desde:
 * controllers, usecases, servicios, clientes externos, etc.
 */
function attachErrorHandlers(
  app: ReturnType<typeof fastify>,
) {
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

  app.setErrorHandler(
    async (
      error,
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
          message: error.message,
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

async function initializeApp() {
  try {
    const app = await buildServer({
      logger: pinoConfigOptions,
    });

    /**
     * Registrar las rutas.
     *
     * ../routers exporta un array con:
     *
     * {
     *   route: FastifyPluginCallback,
     *   prefix: string
     * }
     *
     * Por eso cada router se registra
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
     * Registrar handlers globales DESPUÉS
     * de crear/configurar la aplicación.
     */
    attachErrorHandlers(app);

    /**
     * Levantar servidor directamente con Fastify.
     */
    await app.listen(fastifyConfig);

    logger.info(
      '[server] application started successfully',
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
