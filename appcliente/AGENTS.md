# AGENTS.md — appcliente-orchestrator

## Qué es / qué no es
- Es el **orquestador de fases post-preauth** del flujo `appclient`: `start`, `otp/send`, `otp/verify`, `ocr`, `face`. Orquesta y delega estado.
- **No** tiene base de datos propia: el estado vive en `session-service` (Redis), los tokens en `token-service` y el OTP en `messenger`.
- **No** emite JWTs ni valida hCaptcha. Delega el OTP a `messenger` (`/otp/generate`, `/otp/verify`).
- El scope del `sessionToken` es dinámico: `{flowType}:steps` (ej. `appclient:steps`, `onboarding:steps`). Este orquestador es reutilizable para distintos flujos de canal.

## Comandos
- `npm run build` — `tsc --build tsconfig.json && tsc-alias`
- `npm test` — Jest (`--detectOpenHandles --forceExit`)
- `npm run test:coverage` — Jest con coverage
- `npm run lint` — eslint `./**/*.ts`
- `npm run dev` — ts-node-dev

## Capas (hexagonal)
- `src/app/domain/entities/` — tipos de dominio (`OnboardingStep`, `Channel`).
- `src/app/application/ports/input/` — puertos de entrada (usecases clientes).
- `src/app/application/ports/output/` — puertos de salida: `contracts/*` (Session/Token/Messenger svc), `jwt-verifier.port.ts`, `replay-store.port.ts`.
- `src/app/application/usecases/` — `onboarding.usecase.ts` (lógica de negocio; nombres internos "onboarding" por historial).
- `src/app/infrastructure/` — `clients/` (HTTP: token, session, messenger, device-enrollment), `di/` (tsyringe), `auth/`, `cache/`.
- `src/app/presentation/http/controllers/` — Fastify controllers.
- `src/routers/` — rutas + JSON Schema de body.
- `src/config/`, `src/shared/` — config y utilidades cross-capa.

## Contexto cross-repo
Ver `../ARCHITECTURE.md` para el flujo end-to-end, contratos y decisiones de seguridad compartidas.
