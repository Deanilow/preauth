# Validación end-to-end — Flujo de Onboarding

Cada servicio en su propio puerto (según .env):
- preauth-orchestrator = `8021`
- risk-engine (+ anti-bot) = `8022`
- token-service = `8023`
- session-service = `8024`
- onboarding-orchestrator = `8026`

API Key service-to-service (por header, entre servicios): `dev-service-api-key`

> Nota: los pasos con "REQUIERE valor previo" se completan con el output del paso anterior
> (🚩). Recomiendo usar variables de entorno en tu terminal (bash/zsh) para encadenar.

---

## FASE 1 — Pre-auth (`POST /pre-auth/context-init`)

```bash
# 1) Context-init (público, sin token). Devuelve contextToken + sessionHandle.
curl -sS -X POST "http://127.0.0.1:8021/pre-auth/context-init" \
  -H "content-type: application/json" \
  -H "x-correlation-id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "channel": "web",
    "fingerprint": "a3f5b8e2d1c9f047b3a1e8d2c5f0b7a4",
    "captchaToken": "10000000-aaaa-bbbb-cccc-000000000001"
  }'

# Guardar resultados:
#   export CONTEXT_TOKEN="<contextToken>"
#   export SESSION_HANDLE="<sessionHandle>"
```

**Errores esperados (sin token válido anti-bot):**
```bash
# 2) BOT_DETECTED (403) — captchaToken inválido
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8021/pre-auth/context-init" \
  -H "content-type: application/json" -d '{"channel":"web","fingerprint":"a3f5b8e2d1c9f047b3a1e8d2c5f0b7a4","captchaToken":"TOKEN_INVALIDO"}'
```

---

## FASE 2 — Canje del contextToken (`POST /onboarding/start`)

Requiere `$CONTEXT_TOKEN` y `$SESSION_HANDLE` del paso 1.

```bash
# 3) Start: emite sessionToken, avanza context_issued -> otp_pending
curl -sS -X POST "http://127.0.0.1:8026/onboarding/start" \
  -H "content-type: application/json" \
  -H "x-correlation-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "authorization: Bearer $CONTEXT_TOKEN" \
  -d "{\"sessionHandle\":\"$SESSION_HANDLE\",\"dni\":\"87654321\"}"

# Guardar:
#   export SESSION_TOKEN="<sessionToken>"

# 4) TOKEN_REPLAY (401) — reintentar el MISMO contextToken (single-use)
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8026/onboarding/start" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $CONTEXT_TOKEN" \
  -d "{\"sessionHandle\":\"$SESSION_HANDLE\",\"dni\":\"87654321\"}"
```

---

## FASE 3 — Pasos con `sessionToken` + `X-Request-Id`

Todos requieren `$SESSION_TOKEN` y un `X-Request-Id` nuevo en cada intento.

```bash
# 5) OTP: avanza otp_pending -> ocr_pending.
#    La validación del código OTP la realiza un PROCESO EXTERNO (no este orquestador).
#    Body = solo sessionHandle.
curl -sS -X POST "http://127.0.0.1:8026/onboarding/otp" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $SESSION_TOKEN" \
  -H "x-request-id: 11111111-1111-1111-1111-111111111111" \
  -d "{\"sessionHandle\":\"$SESSION_HANDLE\"}"

# 6) REQUEST_REPLAYED (409) — repetir el MISMO X-Request-Id
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8026/onboarding/otp" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $SESSION_TOKEN" \
  -H "x-request-id: 11111111-1111-1111-1111-111111111111" \
  -d "{\"sessionHandle\":\"$SESSION_HANDLE\"}"

# 7) OCR: avanza ocr_pending -> face_pending (body solo sessionHandle)
curl -sS -X POST "http://127.0.0.1:8026/onboarding/ocr" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $SESSION_TOKEN" \
  -H "x-request-id: 22222222-2222-2222-2222-222222222222" \
  -d "{\"sessionHandle\":\"$SESSION_HANDLE\"}"

# 8) FACE: avanza face_pending -> password_pending (body solo sessionHandle)
curl -sS -X POST "http://127.0.0.1:8026/onboarding/face" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $SESSION_TOKEN" \
  -H "x-request-id: 33333333-3333-3333-3333-333333333333" \
  -d "{\"sessionHandle\":\"$SESSION_HANDLE\"}"
```

> Los endpoints `/onboarding/otp`, `/ocr` y `/face` NO reciben `otpCode` / `ocrToken` /
> `faceToken`. La validación de esos códigos la realiza un proceso externo que opera
> sobre `session-service` (`POST /sessions/{handle}/verify-otp` y la integración OCR/
> biometría). Este orquestador solo avanza la state machine con `sessionHandle` +
> `sessionToken` + `X-Request-Id`.

---

## FASE 0 — Verificación de dependencias (opcional, para debug)

```bash
# Token Service: JWKS (público)
curl -sS "http://127.0.0.1:8023/jwks" | jq .keys[0].kid

# Session Service: estado actual de la sesión (requiere API Key)
curl -sS "http://127.0.0.1:8024/sessions/$SESSION_HANDLE" \
  -H "authorization: Bearer dev-service-api-key"

# Risk Engine: /health
curl -sS "http://127.0.0.1:8022/health"
```

---

## Matriz de errores esperados

| Endpoint | Error | HTTP | Cómo provocarlo |
|---|---|---|---|
| `/pre-auth/context-init` | `BOT_DETECTED` | 403 | captchaToken inválido |
| `/pre-auth/context-init` | `RISK_DENIED` | 403 | risk deny (IP en blacklist / score alto) |
| `/pre-auth/context-init` | `CHALLENGE_REQUIRED` | 429 | risk challenge |
| `/onboarding/start` | `TOKEN_REPLAY` | 401 | reusar el mismo contextToken |
| `/onboarding/start` | `INVALID_DNI` | 422 | DNI no numérico o != 8 dígitos |
| `/onboarding/start` | `CHANNEL_MISMATCH` | 403 | canal del token ≠ canal de sesión |
| `/onboarding/start` | `INVALID_STEP_SEQUENCE` | 409 | sesión ya no está en `context_issued` |
| `/onboarding/start` | `SESSION_NOT_FOUND` | 404 | sessionHandle expiró / inválido |
| `/onboarding/otp` | `MISSING_REQUEST_ID` | 400 | sin header `X-Request-Id` |
| `/onboarding/otp` | `REQUEST_REPLAYED` | 409 | mismo `X-Request-Id` repetido |
| `/onboarding/otp|ocr|face` | `INVALID_STEP_SEQUENCE` | 409 | paso actual ≠ esperado |
| `/onboarding/otp|ocr|face` | `STEP_EXPIRED` | 410 | paso venció (TTL) o techo 900s |
| `/onboarding/otp|ocr|face` | `INVALID_TOKEN` | 401 | sessionToken inválido / scope / sub |

> Los endpoints `/onboarding/products` y `/onboarding/password` están **deshabilitados** (otro proceso los maneja), no se validan acá.
