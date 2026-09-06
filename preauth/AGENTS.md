# AGENTS.md — preauth-orchestrator

## Qué es / qué no es
- Es el **punto de entrada público** (`POST /pre-auth/context-init`) y el único endpoint sin token previo.
- Orquesta en orden: anti-bot → risk → emisión `contextToken` → creación de sesión.
- **No** tiene base de datos: errores en código (`BUSINESS_ERROR_CODES`). **No** valida hCaptcha ni firma JWTs (delega vía ports).

## Comandos
- `npm run build` — `tsc --build tsconfig.json && tsc-alias`
- `npm test` — Jest (`--detectOpenHandles --forceExit`)
- `npm run test:coverage` — Jest con coverage
- `npm run lint` — eslint `./**/*.ts`
- `npm run dev` — ts-node-dev

## Capas (hexagonal)
- `src/app/domain/entities/` — `channel.ts` (`CHANNEL` const + `Channel` type).
- `src/app/application/ports/input/` — `pre-auth.input.ts`, `pre-auth.request.ts`, `pre-auth.response.ts`.
- `src/app/application/ports/output/contracts/` — `anti-bot.ts`, `risk-engine.ts`, `session-service.ts`, `token-service.ts`.
- `src/app/application/usecases/` — `pre-auth.usecase.ts` (contextInit: anti-bot → risk → tokens).
- `src/app/infrastructure/` — `clients/` (`anti-bot`, `risk-engine`, `session-service`, `token-service`), `di/` (tsyringe).
- `src/app/presentation/http/controllers/` — Fastify controllers.
- `src/routers/` — rutas + JSON Schema.
- `src/config/`, `src/shared/` — config y utilidades.

## Contexto cross-repo
Ver `../ARCHITECTURE.md` para la Fase 1 (pre-auth gate), contratos y seguridad.
