# AGENTS.md — risk-engine

## Qué es / qué no es
- Es el **risk engine** que incluye internamente el módulo **anti-bot hCaptcha** (no separado en otro repo).
- `POST /anti-bot/verify` valida el captcha real contra hCaptcha; `POST /risk/evaluate` produce `allow|challenge|deny`.
- **No** es el punto de entrada público ni manipula sesiones/tokens: expone servicios consumidos por `preauth-orchestrator`.

## Comandos
- `npm run build` — `tsc --build tsconfig.json && tsc-alias`
- `npm test` — Jest (`--detectOpenHandles --forceExit`)
- `npm run test:coverage` — Jest con coverage
- `npm run lint` — eslint `./**/*.ts`
- `npm run dev` — ts-node-dev

## Capas (hexagonal)
- `src/app/domain/entities/` — `channel.ts`, `risk-decision.ts` (`RISK_DECISION`), `velocity-check.ts`.
- `src/app/application/ports/input/` — `anti-bot.input.ts`, `risk.input.ts`.
- `src/app/application/ports/output/` — `risk-state.port.ts`.
- `src/app/application/usecases/` — `anti-bot.usecase.ts`, `risk.usecase.ts`.
- `src/app/infrastructure/` — `clients/` (`hcaptcha.client.ts` usa `https` nativo, no JSON HTTP), `auth/`, `cache/`, `di/`.
- `src/app/presentation/http/controllers/` + `schema/` — controllers y schemas.
- `src/routers/` — `anti-bot/`, `risk/` + JSON Schema.
- `src/config/`, `src/shared/` — config, errors (`errorNormalizer`, `integration.error`).

## Contexto cross-repo
Ver `../ARCHITECTURE.md` para Fase 1, AntiBotMetadata y decisiones de seguridad (hCaptcha real).
