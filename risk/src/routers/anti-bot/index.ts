import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { container } from '../../app/infrastructure/di/container';
import { DI_TOKENS } from '../../app/infrastructure/di/tokens';
import { AntiBotController } from 'app/presentation/http/controllers/anti-bot.controller';
import { verifyAntiBotSchema } from 'app/presentation/http/schema/anti-bot.schema';
import { serviceApiKeyPreHandler } from 'app/presentation/http/middleware/service-api-key';

const antiBotController = container.resolve<AntiBotController>(DI_TOKENS.AntiBotController);

const routerAntiBot: FastifyPluginCallback = (app: FastifyInstance, _options, done) => {
  app.route({
    method: 'POST',
    url: '/verify',
    preHandler: [serviceApiKeyPreHandler()],
    schema: verifyAntiBotSchema,
    handler: antiBotController.verify.bind(antiBotController),
  });

  done();
};

export default routerAntiBot;
