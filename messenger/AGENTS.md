# AGENTS.md — messenger

## Qué es / qué no es
- Es el **servicio de OTP**: `POST /otp/generate` y `POST /otp/verify`.
- **No genera ni valida el código real**: delega a un "otro servicio" (`OtpProviderPort`), actualmente mockeado.
- **No persiste nada en Redis**: no guarda el código. Solo valida el token/paso y delega.
- **No** genera tokens ni maneja la state machine de la sesión. El avance de pasos lo hace `appcliente`.

## Comandos
- `npm run build` — `tsc --build tsconfig.json && tsc-alias`
- `npm test` — Jest
- `npm run lint` — eslint `./**/*.ts`
- `npm run dev` — ts-node-dev

## Capas (hexagonal)
- `src/app/application/ports/input/` — `otp.input.ts`.
- `src/app/application/ports/output/` — `otp-provider.port.ts`, `jwt-verifier.port.ts`, `contracts/`.
- `src/app/application/usecases/` — `otp.usecase.ts` (valida token/paso + delega al provider).
- `src/app/infrastructure/` — `auth/` (jose-jwt-verifier), `sms/` (mock provider), `clients/` (session-service), `di/`.
- `src/app/presentation/http/controllers/` + `dto/`.
- `src/routers/` — `otp/` + JSON Schema.
- `src/config/`, `src/shared/` — config, errors (`MSG-*` codes).

## Contexto cross-repo
Ver `../ARCHITECTURE.md`. `appcliente` llama a este servicio (`/otp/generate`, `/otp/verify`).
El scope del token es dinámico `{flowType}:steps`; este servicio valida el `flowType` de la sesión.
