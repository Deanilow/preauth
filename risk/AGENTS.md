# AGENTS.md — risk-engine

## Qué es / qué no es
- Es el **risk engine** que incluye internamente el módulo **anti-bot hCaptcha** (no separado en otro repo).
- `POST /anti-bot/verify` valida el captcha real contra hCaptcha (Enterprise/Pro: `botScore`, `botScoreReason`, `pass`; `mode='bypass'` si no hay `HCAPTCHA_SECRET`); `POST /risk/evaluate` produce `allow|challenge|deny`.
- **No** es el punto de entrada público ni manipula sesiones/tokens: expone servicios consumidos por `preauth-orchestrator`.
- Score 0-100 desde: `antiBotScore`+metadata hCaptcha, reputación IP, velocity por `clientIp`, historial del fingerprint (`fingerprintKnown`/`newDevice`/`travelAnomaly`/`userAgentConsistent`) y `deviceMetadata` nativo (Play Integrity/DeviceCheck). El `fingerprint` sí puntúa.
- Contrato OpenAPI real: `risk/api/swagger/openapi.yaml`.

## TODO pendiente
- **Play Integrity / DeviceCheck**: hoy el campo `deviceMetadata` en `POST /risk/evaluate` es **deny-accepted pero no se valida server-side** contra el proveedor. Falta la integración real con Google Play Integrity (Android) y Apple DeviceCheck/App Attest (iOS). El token de atestación viaja en `captchaToken` de Preauth; se debe validar y mapear a `deviceMetadata.verdict` antes de que impacte el score.

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
