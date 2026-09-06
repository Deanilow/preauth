# AGENTS.md — session-service

## Qué es / qué no es
- Es la **state machine de la sesión sobre Redis**: `context_issued → otp_pending → ocr_pending → face_pending → password_pending → completed`.
- Única fuente de verdad de TTLs por paso y del techo absoluto de 900s (`absoluteExpiresAt`).
- Estados de error BD-backed; estado de negocio en Redis. **No** orquesta comandos ni emite tokens.

## Comandos
- `npm run build` — `tsc --build tsconfig.json && tsc-alias`
- `npm test` — Jest (`--detectOpenHandles --forceExit`)
- `npm run test:coverage` — Jest con coverage
- `npm run lint` — eslint `./**/*.ts`
- `npm run dev` — ts-node-dev

## Capas (hexagonal)
- `src/app/domain/entities/` — `channel.ts`, `session-state.ts` (`OnboardingStep`, `SessionMetadata`, `SessionRecord`).
- `src/app/application/ports/input/` — `session.input.ts` (createSession/getSession/advance/invalidate/verifyOtp).
- `src/app/application/ports/output/` — `session-state.port.ts` (save/find/delete/linkSub/findByUserSub).
- `src/app/application/usecases/` — `session.usecase.ts` (fuente de verdad de `STEP_TRANSITIONS` y TTLs).
- `src/app/infrastructure/` — `cache/` (Redis), `clients/`, `di/` (tsyringe).
- `src/app/presentation/http/controllers/` + `schema/` — controllers y schemas.
- `src/routers/` — `sessions/` + JSON Schema.
- `src/config/`, `src/shared/` — config, errors.

## Contexto cross-repo
Ver `../ARCHITECTURE.md` para state machine, `linkSub`, y seguridad (OTP nunca expuesto; anti-replay).
