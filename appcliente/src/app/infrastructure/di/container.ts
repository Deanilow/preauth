import { container } from 'tsyringe';
import { DI_TOKENS } from './tokens';

// ─── HTTP ─────────────────────────────────────────────────────────────────────
import { HttpClientService } from '../http/http-client.service';

// ─── Auth / Cache ─────────────────────────────────────────────────────────────
import { JoseJwtVerifier } from '../auth/jose-jwt-verifier';
import { RedisReplayStoreService } from '../cache/replay-store.service';

// ─── Clients ──────────────────────────────────────────────────────────────────
import { TokenServiceClient } from '../clients/token-service.client';
import { SessionServiceClient } from '../clients/session-service.client';
import { DeviceEnrollmentClient } from '../clients/device-enrollment.client';
import { MessengerClient } from '../clients/messenger.client';

// ─── Use Cases ────────────────────────────────────────────────────────────────
import { OnboardingUseCase } from '../../application/usecases/onboarding.usecase';

// ─── Controllers ──────────────────────────────────────────────────────────────
import { OnboardingController } from '../../presentation/http/controllers/onboarding.controller';

// HTTP
container.registerSingleton(DI_TOKENS.HttpClientService, HttpClientService);

// Auth / Cache
container.registerInstance(DI_TOKENS.JwtVerifierPort, new JoseJwtVerifier());
container.registerSingleton(DI_TOKENS.ReplayStorePort, RedisReplayStoreService);

// Clients
container.register(DI_TOKENS.TokenServiceClient, { useClass: TokenServiceClient });
container.register(DI_TOKENS.SessionServiceClient, { useClass: SessionServiceClient });
container.register(DI_TOKENS.DeviceEnrollmentClient, { useClass: DeviceEnrollmentClient });
container.register(DI_TOKENS.MessengerClient, { useClass: MessengerClient });

// Use Cases
container.register(DI_TOKENS.OnboardingInputPort, { useClass: OnboardingUseCase });

// Controllers
container.register(DI_TOKENS.OnboardingController, { useClass: OnboardingController });

export { container };
