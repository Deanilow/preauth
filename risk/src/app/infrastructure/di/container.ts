import { container } from 'tsyringe';
import { DI_TOKENS } from './tokens';

// ─── Infrastructure ───────────────────────────────────────────────────────────
import { HttpClientService } from '../http/http-client.service';

// ─── Auth ─────────────────────────────────────────────────────────────────────

// ─── Clients ──────────────────────────────────────────────────────────────────

// ─── Repositories ─────────────────────────────────────────────────────────────

// ─── Adapters ─────────────────────────────────────────────────────────────────

// ─── Cache / Error Catalog ────────────────────────────────────────────────────

// ─── Handlers ─────────────────────────────────────────────────────────────────

// ─── Use Cases ───────────────────────────────────────────────────────────────
import { AntiBotUseCase } from 'app/application/usecases/anti-bot.usecase';
import { RiskUseCase } from 'app/application/usecases/risk.usecase';

// ─── Controllers ─────────────────────────────────────────────────────────────
import { AntiBotController } from 'app/presentation/http/controllers/anti-bot.controller';
import { RiskController } from 'app/presentation/http/controllers/risk.controller';
// ─── Anti-bot (hCaptcha) ───────────────────────────────────────────────────────────────────────
import { HCaptchaClient } from '../clients/hcaptcha.client';
// ─── Risk Engine (estado interno en memoria) ─────────────────────────────────────────
import { RiskStateService } from '../cache/risk-state.service';

// ══════════════════════════════════════════════════════════════════════════════
// 1. INFRASTRUCTURE
// ══════════════════════════════════════════════════════════════════════════════

container.registerSingleton(DI_TOKENS.HttpClientService, HttpClientService);
container.registerSingleton(DI_TOKENS.HCaptchaClient, HCaptchaClient);

// ══════════════════════════════════════════════════════════════════════════════
// 2. AUTH
// ══════════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════════
// 3. CLIENTS
// ══════════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════════
// 4. ADAPTERS
// ══════════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════════
// 5. REPOSITORIES
// ══════════════════════════════════════════════════════════════════════════════

// ═══ 5.1 RISK ENGINE STATE (adapter en memoria) ════════════════════════════════════════════════════
container.registerSingleton(DI_TOKENS.RiskStatePort, RiskStateService);

// ══════════════════════════════════════════════════════════════════════════════
// 6. ERROR CATALOG
// ══════════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════════
// 8. USE CASES
// ══════════════════════════════════════════════════════════════════════════════



// Anti-bot primero, luego Risk Engine (orden del flujo pre-auth que las consume)
container.register(DI_TOKENS.AntiBotInputPort, { useClass: AntiBotUseCase });
container.register(DI_TOKENS.RiskInputPort, { useClass: RiskUseCase });

// ══════════════════════════════════════════════════════════════════════════════
// 9. CONTROLLERS
// ══════════════════════════════════════════════════════════════════════════════

container.register(DI_TOKENS.AntiBotController, { useClass: AntiBotController });
container.register(DI_TOKENS.RiskController, { useClass: RiskController });

export { container };