# AGENTS.md — token-service

## Qué es / qué no es
- Es el **único servicio que firma JWTs**: `POST /tokens/context` (`contextToken`, single-use) y `POST /tokens/session` (`sessionToken`, multi-uso).
- Expone `GET /jwks` (claves públicas RS256) para verificación remota.
- **No** valida tokens de otros servicios, **no** gestiona sesiones ni riesgo: emite/expone claves. Llave privada = placeholder de dev (`TOKEN_PRIVATE_KEY_B64`); prod debe usar KMS/HSM.

## Comandos
- `npm run build` — `tsc --build tsconfig.json && tsc-alias`
- `npm test` — Jest (`--detectOpenHandles --forceExit`)
- `npm run test:coverage` — Jest con coverage
- `npm run lint` — eslint `./**/*.ts`
- `npm run dev` — ts-node-dev

## Capas (hexagonal)
- `src/app/domain/entities/` — `channel.ts`, `currency.ts` (`CURRENCY`, `mapCobisCurrencyCodeToIso`).
- `src/app/application/ports/input/` — `token.input.ts` (emitContextToken/emitSessionToken/getJwks).
- `src/app/application/ports/output/` — `digital-token.port.ts` (signer + `JwksResult`).
- `src/app/application/usecases/` — `token.usecase.ts` (claims contextToken vs sessionToken).
- `src/app/infrastructure/` — `auth/` (`jwtSigner.ts` RS256 + kid), `mapper/`, `clients/`, `di/`.
- `src/app/presentation/http/controllers/` + `schema/` — `token.controller.ts`, `service-api-key` middleware.
- `src/routers/` — `tokens/` + JSON Schema.
- `src/config/`, `src/shared/` — config, notifications, errors.

## Contexto cross-repo
Ver `../ARCHITECTURE.md` para claims, TTLs, jti/anti-replay y seguridad (RS256 + JWKS).
