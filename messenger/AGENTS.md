# AGENTS.md — messenger

## Qué es / qué no es
- Es el **servicio de OTP**: `POST /otp/generate` (genera código y simula envío al celular) y `POST /otp/verify` (valida contra Redis).
- Guarda el código en Redis (`otp:{sessionHandle}`) con TTL 180s y máx 3 intentos.
- **No** genera tokens, **no** maneja la state machine de la sesión: solo el OTP. El avance de pasos lo hace `onboarding`.
- El envío al celular es **SIMULADO** (no hay proveedor SMS real integrado).

## Comandos
- `npm run build` — `tsc --build tsconfig.json && tsc-alias`
- `npm test` — Jest
- `npm run lint` — eslint `./**/*.ts`
- `npm run dev` — ts-node-dev

## Capas (hexagonal)
- `src/app/domain/entities/` — `otp.ts` (`OtpRecord`, `OTP_MAX_ATTEMPTS`), `channel.ts`.
- `src/app/application/ports/input/` — `otp.input.ts`.
- `src/app/application/ports/output/` — `otp-store.port.ts`, `sms-sender.port.ts`, `jwt-verifier.port.ts`, `contracts/`.
- `src/app/application/usecases/` — `otp.usecase.ts` (generate/verify + assertTokenAndStep).
- `src/app/infrastructure/` — `auth/` (jose-jwt-verifier), `cache/` (Redis OTP store), `sms/` (mock), `clients/` (session-service), `di/`.
- `src/app/presentation/http/controllers/` + `dto/` — controllers y DTOs.
- `src/routers/` — `otp/` + JSON Schema.
- `src/config/`, `src/shared/` — config, errors (`MSG-*` codes).

## Contexto cross-repo
Ver `../ARCHITECTURE.md` para el flujo end-to-end. `onboarding` llama a este servicio
(`/otp/generate` y `/otp/verify`) para generar/validar el OTP; la state machine sigue en `session-service`.
