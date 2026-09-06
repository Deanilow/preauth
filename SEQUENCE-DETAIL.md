# Paso a paso end-to-end — cada punto y su repositorio

Detalle exhaustivo de cada interacción de la secuencia anterior, en orden estricto de
ejecución, indicando **qué repositorio ejecuta el paso**, el endpoint exacto y qué pasa
internamente. Los pasos 1–11 son la Fase 1 (pre-auth), 12–19 la Fase 2 (canje del
contextToken), y 20–39 la Fase 3 (los 3 pasos multi-pantalla implementados: ocr, face, otp).

### Fase 1 — Pre-auth gate (`POST /pre-auth/context-init`)

| # | Repositorio | Acción |
|---|---|---|
| 1 | Cliente → **preauth-orchestrator** | `POST /pre-auth/context-init` con `{ channel, fingerprint, captchaToken }`. Único endpoint público sin token previo. |
| 2 | **preauth-orchestrator** | `PreAuthUseCase.contextInit()` invoca primero `verifyAntiBot()`. |
| 3 | preauth-orchestrator → **risk-engine** | `POST /anti-bot/verify` con `{ channel, captchaToken, clientIp }` (`AntiBotClient`). |
| 4 | **risk-engine** | `AntiBotUseCase` llama a `HCaptchaClient` → `POST https://api.hcaptcha.com/siteverify` (form-urlencoded, real, no simulado) con `secret+response(+remoteip)`. |
| 5 | risk-engine → preauth-orchestrator | Responde `{ verified, score, metadata: AntiBotMetadata{ provider:'hcaptcha', mode, hostname, challengeTs, errorCodes, botScore, botScoreReason } }`. Si `verified=false` → preauth-orchestrator lanza `BOT_DETECTED` (403) y el flujo termina aquí. |
| 6 | **preauth-orchestrator** | Si el anti-bot fue verificado, `evaluateRisk()` continúa. |
| 7 | preauth-orchestrator → **risk-engine** | `POST /risk/evaluate` con `{ clientIp, fingerprint, userAgent, channel, antiBotScore, antiBotMetadata, correlationId }` (`RiskEngineClient`). |
| 8 | **risk-engine** | `RiskUseCase` combina fingerprint/IP/canal/`antiBotMetadata` y produce `decision: 'allow' \| 'challenge' \| 'deny'`. |
| 9 | risk-engine → preauth-orchestrator | Responde `{ decision, score }`. Si `deny` → `RISK_DENIED` (403); si `challenge` → `CHALLENGE_REQUIRED` (429). Si el Risk Engine no responde (error de red), preauth-orchestrator **falla cerrado**: nunca asume `allow` por defecto (`RISK_DENIED`). Solo con `allow` continúa el flujo. |
| 10 | preauth-orchestrator → **token-service** | `POST /tokens/context` con `{ channel, fingerprint, clientIp, correlationId }` (`TokenServiceClient.issueContextToken`), **en paralelo** (`Promise.all`) con el paso 12. |
| 11 | **token-service** | `TokenUseCase.emitContextToken()` genera `jti=randomUUID()`, firma RS256 (`JwtSigner`, `kid` fijo) el payload `{ iss:'token-service', aud:'preauth-api', scope:'preauth:onboarding.start', channel, jti, fp:sha256(fingerprint), ipHash:sha256(clientIp) }` con TTL 120s. Responde `{ token, jti, expiresIn:120 }`. |
| 12 | preauth-orchestrator → **session-service** | `POST /sessions` con `{ channel, clientIp, fingerprint, correlationId }` (`SessionServiceClient.createSession`), en paralelo con el paso 10. |
| 13 | **session-service** | `SessionUseCase.createSession()` genera `sessionHandle` (UUID) y escribe en Redis `SET flow:{sessionHandle} {...} EX 120` con `step='context_issued'`. Responde `{ sessionHandle, step, expiresIn:120 }`. |
| 14 | **preauth-orchestrator** | Combina ambas respuestas y responde al cliente `200 { contextToken, sessionHandle, expiresIn:120 }`. Si algo fue `challenge`/`deny` en el paso 9, aquí se devuelve `403`/`429` en su lugar (nunca se llega a emitir token/sesión). |

### Fase 2 — Canje del contextToken (`POST /onboarding/start`)

| # | Repositorio | Acción |
|---|---|---|
| 15 | Cliente → **onboarding-orchestrator** | `POST /onboarding/start` con header `Authorization: Bearer {contextToken}` y body `{ sessionHandle, dni }`. El cliente obtuvo `contextToken`+`sessionHandle` de la Fase 1; el `dni` es nuevo, ingresado en este paso. |
| 16 | onboarding-orchestrator → **token-service** | `GET /jwks` (indirecto, vía `jose.createRemoteJWKSet`, cacheado). `JoseJwtVerifier.verify(contextToken, aud='preauth-api')` valida firma RS256 + `aud`. Si falla → `INVALID_TOKEN` (401). |
| 17 | **onboarding-orchestrator** | Valida `claims.scope === 'preauth:onboarding.start'` (si no, `INVALID_TOKEN`) y que `claims.jti` exista (si no, `INVALID_TOKEN`). |
| 18 | onboarding-orchestrator → **Redis** (compartido) | `SET ctx:jti:{jti} 1 EX 120 NX` (`ReplayStorePort.consumeOnce`). Si la clave ya existía → `TOKEN_REPLAY` (401): el contextToken ya fue canjeado antes. |
| 19 | **onboarding-orchestrator** | Valida binding de IP (`assertIpBinding`: `sha256(clientIp actual) === claims.ipHash`, si no `IP_BINDING_MISMATCH` 403) y formato del DNI (`assertDni`, si no `INVALID_DNI` 422). |
| 20 | onboarding-orchestrator → **session-service** | `GET /sessions/{sessionHandle}` (`SessionServiceClient.getSession`). Si no existe/expiró → `404 SESSION_NOT_FOUND`. |
| 21 | **onboarding-orchestrator** | Valida `claims.channel === session.channel` (si no `CHANNEL_MISMATCH` 403) y `session.step === 'context_issued'` (si no `INVALID_STEP_SEQUENCE` 409). |
| 22 | **onboarding-orchestrator** | Genera `userSub = randomUUID()` (GUID aleatorio, no derivado del DNI ni de ningún otro dato). El OTP **no** se genera en este paso — se genera más adelante, en la transición `face_pending → otp_pending` (paso 36). |
| 23 | onboarding-orchestrator → **session-service** | `PUT /sessions/{sessionHandle}/advance` con `{ fromStep:'context_issued', toStep:'ocr_pending', metadata:{ dni, userSub } }` (`AdvanceStepRequest`). |
| 24 | **session-service** | `SessionUseCase.advanceStep()` valida la transición, calcula `effectiveTtlSeconds = min(120, secondsUntilAbsoluteExpiry)` (techo de 900s), mergea `metadata` en el registro, y **si `metadata.userSub` está presente**, llama `linkSub(userSub, sessionHandle, ttl)` → `SET sub:{userSub} {sessionHandle} EX {ttl}` en Redis — este es el índice cruzado por `sub` consultable directamente por cualquier servicio. Responde `{ sessionHandle, step:'ocr_pending', ... }`. |
| 25 | onboarding-orchestrator → **token-service** | `POST /tokens/session` con `{ sessionHandle, channel, clientIp, correlationId }` (`TokenServiceClient.issueSessionToken`). |
| 26 | **token-service** | `TokenUseCase.emitSessionToken()` firma RS256 el payload `{ iss:'token-service', aud:'onboarding-service', scope:'onboarding.active', sub:'session:{sessionHandle}', channel, ipHash, jti }` con TTL 900s. Responde `{ token, jti, expiresIn:900 }`. |
| 27 | **onboarding-orchestrator** → Cliente | Responde `200 { sessionToken, step:'ocr_pending', expiresIn:900 }`. |

### Fase 3 — Pasos multi-pantalla (`sessionToken` + `X-Request-Id`)

Los 3 pasos siguientes (los únicos implementados en este repositorio) comparten el
mismo patrón de guardas (`fase3Guard()` en `onboarding-orchestrator`), ejecutado
**antes** de la lógica específica de cada paso:

| # | Repositorio | Acción común (`fase3Guard`) |
|---|---|---|
| 28 | onboarding-orchestrator | Exige header `X-Request-Id`; si falta → `MISSING_REQUEST_ID` (400). |
| 29 | onboarding-orchestrator → token-service (JWKS) | Verifica firma/`aud='onboarding-service'` del `sessionToken` vía `jose`. Si falla → `INVALID_TOKEN` (401). |
| 30 | onboarding-orchestrator | Valida `claims.scope === 'onboarding.active'` y `claims.sub === 'session:{sessionHandle}'` (si no `INVALID_TOKEN` 401). |
| 31 | onboarding-orchestrator → Redis | `SET req:{sessionHandle}:{requestId} 1 EX 30 NX`. Si ya existía → `REQUEST_REPLAYED` (409): reintento del mismo request. |
| 32 | onboarding-orchestrator | Valida binding de IP (`IP_BINDING_MISMATCH` 403 si no coincide). |
| 33 | onboarding-orchestrator → session-service | `GET /sessions/{sessionHandle}` para obtener el estado actual. |
| 34 | onboarding-orchestrator | Valida `channel` (`CHANNEL_MISMATCH` 403), que `session.step === expectedStep` del endpoint llamado (`INVALID_STEP_SEQUENCE` 409), y que el paso actual no haya expirado (`STEP_EXPIRED` 410). |

Con la guarda superada, cada endpoint ejecuta su lógica propia:

| # | Repositorio | Endpoint / Acción específica |
|---|---|---|
| 35 | Cliente → **onboarding-orchestrator** | `POST /onboarding/ocr` con `{ sessionHandle, ocrToken }`. Tras `fase3Guard` (esperando `step='ocr_pending'`): validación simulada (no hay proveedor OCR real integrado; `ocrToken==='FORCE_FAIL'` fuerza `OCR_VALIDATION_FAILED` 422 para pruebas). |
| 36 | onboarding-orchestrator → session-service | `PUT /sessions/{sessionHandle}/advance` `{ fromStep:'ocr_pending', toStep:'face_pending' }`. Responde `200 { step:'face_pending' }` al cliente. |
| 37 | Cliente → **onboarding-orchestrator** | `POST /onboarding/face` con `{ sessionHandle, faceToken }`. Tras `fase3Guard` (esperando `step='face_pending'`): validación simulada (no hay proveedor biométrico real integrado; `faceToken==='FORCE_FAIL'` fuerza `FACE_VALIDATION_FAILED` 422 para pruebas). Aquí se genera el OTP de 6 dígitos (`generateOtp()`, `crypto.randomBytes`) — nunca devuelto en la respuesta HTTP. |
| 38 | onboarding-orchestrator → session-service | `PUT /sessions/{sessionHandle}/advance` `{ fromStep:'face_pending', toStep:'otp_pending', metadata:{ otpCode, otpExpiresAt } }`. Responde `200 { step:'otp_pending' }`. |
| 39 | Cliente → **onboarding-orchestrator** | `POST /onboarding/otp` con `{ sessionHandle, otpCode }`. Tras `fase3Guard` (esperando `step='otp_pending'`): `POST /sessions/{sessionHandle}/verify-otp` con `{ otpCode }`. `SessionUseCase.verifyOtp()` compara server-side contra `record.otpCode`/`otpExpiresAt` — el OTP nunca sale de session-service por ningún otro endpoint. Responde `{ valid: boolean }`. Si `false` → onboarding-orchestrator lanza `INVALID_OTP` (422). |
| 40 | onboarding-orchestrator → session-service | `PUT /sessions/{sessionHandle}/advance` `{ fromStep:'otp_pending', toStep:'password_pending' }`. Responde `200 { step:'password_pending' }` — **fin del flujo implementado en este repositorio**. Aquí termina el hand-off: otro proceso (fuera de este workspace) continúa consultando/avanzando la misma sesión en `session-service`, validando primero que el `sessionToken` sea válido y luego que la sesión en Redis esté efectivamente en `password_pending` antes de continuar (selección de productos, creación de contraseña, enrolamiento de dispositivo). Los endpoints `/onboarding/products` y `/onboarding/password` siguen presentes en el código de este repo (sin cambios), pero no se usan todavía y quedan inalcanzables por el momento, ya que `session-service` ya no define una transición `password_pending → password_creation`. |
