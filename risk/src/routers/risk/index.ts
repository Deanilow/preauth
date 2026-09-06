import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { container } from '../../app/infrastructure/di/container';
import { DI_TOKENS } from '../../app/infrastructure/di/tokens';
import { RiskController } from 'app/presentation/http/controllers/risk.controller';
import { evaluateRiskSchema } from 'app/presentation/http/schema/risk.schema';
import { serviceApiKeyPreHandler } from 'app/presentation/http/middleware/service-api-key';

const riskController = container.resolve<RiskController>(DI_TOKENS.RiskController);

const routerRisk: FastifyPluginCallback = (app: FastifyInstance, _options, done) => {
  app.route({
    method: 'POST',
    url: '/evaluate',
    preHandler: [serviceApiKeyPreHandler()],
    schema: evaluateRiskSchema,
    handler: riskController.evaluate.bind(riskController),
  });

  done();
};

export default routerRisk;
