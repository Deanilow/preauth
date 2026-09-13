import { container } from 'tsyringe';
import { DI_TOKENS } from './tokens';

// ─── HTTP ─────────────────────────────────────────────────────────────────────
import { HttpClientService } from '../http/http-client.service';

// ─── Auth / Cache / Sms ───────────────────────────────────────────────────────
import { JoseJwtVerifier } from '../auth/jose-jwt-verifier';
import { RedisOtpStoreService } from '../cache/otp-store.service';
import { MockSmsSenderService } from '../sms/mock-sms-sender.service';

// ─── Clients ──────────────────────────────────────────────────────────────────
import { SessionServiceClient } from '../clients/session-service.client';

// ─── Use Cases ────────────────────────────────────────────────────────────────
import { OtpUseCase } from '../../application/usecases/otp.usecase';

// ─── Controllers ──────────────────────────────────────────────────────────────
import { OtpController } from '../../presentation/http/controllers/otp.controller';

// HTTP
container.registerSingleton(DI_TOKENS.HttpClientService, HttpClientService);

// Auth / Cache / Sms
container.registerInstance(DI_TOKENS.JwtVerifierPort, new JoseJwtVerifier());
container.registerSingleton(DI_TOKENS.OtpStorePort, RedisOtpStoreService);
container.registerSingleton(DI_TOKENS.SmsSenderPort, MockSmsSenderService);

// Clients
container.register(DI_TOKENS.SessionServiceClient, { useClass: SessionServiceClient });

// Use Cases
container.register(DI_TOKENS.OtpInputPort, { useClass: OtpUseCase });

// Controllers
container.register(DI_TOKENS.OtpController, { useClass: OtpController });

export { container };
