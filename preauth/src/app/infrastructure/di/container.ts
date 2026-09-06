
import { container } from 'tsyringe';
import { DI_TOKENS } from './tokens';
import { HttpClientService } from '../http/http-client.service';
import { ClientConstants } from '../clients/client.constants';
import { AntiBotClient } from '../clients/anti-bot.client';
import { RiskEngineClient } from '../clients/risk-engine.client';
import { TokenServiceClient } from '../clients/token-service.client';
import { SessionServiceClient } from '../clients/session-service.client';
import { PreAuthUseCase } from '../../application/usecases/pre-auth.usecase';
import { PreAuthController } from '../../presentation/http/controllers/pre-auth.controller';

// Auth

// HTTP
container.registerSingleton(DI_TOKENS.HttpClientService, HttpClientService);

// Clients
container.register(DI_TOKENS.AntiBotClient, { useClass: AntiBotClient });
container.register(DI_TOKENS.RiskEngineClient, { useClass: RiskEngineClient });
container.register(DI_TOKENS.TokenServiceClient, { useClass: TokenServiceClient });
container.register(DI_TOKENS.SessionServiceClient, { useClass: SessionServiceClient });

// Ports (Gateways & Repositories)

// Use Cases
container.register(DI_TOKENS.PreAuthInputPort, { useClass: PreAuthUseCase });

// Controllers
container.register(DI_TOKENS.PreAuthController, { useClass: PreAuthController });

export { container };
