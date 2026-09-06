# Flujo de Onboarding — Arquitectura General

Este documento relaciona los 5 microservicios que conforman el flujo completo de
onboarding digital (pre-autenticación + fases de alta de cliente), su responsabilidad
individual, sus contratos entre sí, y la secuencia end-to-end.

> Referencia visual: `sur-auth-ms-onboarding-risk-engine/api/swagger/01-preauth-token-exchange 1.png`.
> La sección [Comparación con el diagrama de referencia](#comparación-con-el-diagrama-de-referencia)
> al final de este documento detalla qué coincide exactamente con esa imagen y qué se implementó
> distinto (y por qué).

## Repositorios involucrados

| Repositorio | Rol | Base de datos |
|---|---|---|
| `sur-auth-ms-onboarding-preauth-orchestrator` | Punto de entrada público. Orquesta anti-bot + risk + emisión del primer token. | No (in-code errors) |
| `sur-auth-ms-onboarding-risk-engine` | Verificación anti-bot (hCaptcha real) + scoring de riesgo. | BD-backed (ErrorCatalogService) |
| `sur-auth-ms-onboarding-token-service` | Emisión y verificación de JWTs (RS256) + JWKS público. | BD-backed |
| `sur-auth-ms-onboarding-session-service` | Estado de la sesión de onboarding (state machine) sobre Redis. | BD-backed (errores) + Redis (estado) |
| `sur-auth-ms-onboarding-onboarding-orchestator` | Orquesta las fases de onboarding posteriores al pre-auth. | No (in-code errors) |

Ningún servicio de orquestación (`preauth-orchestrator`, `onboarding-orchestrator`) tiene
base de datos propia: son coordinadores puros que delegan estado a `session-service` (Redis)
y emisión/verificación de tokens a `token-service`. `risk-engine` incluye internamente el
módulo anti-bot (no está separado en otro servicio, por decisión explícita).

## State machine — orden vigente

```
context_issued → otp_pending → ocr_pending → face_pending → password_pending → completed
      (120s)        (120s)         (120s)          (120s)          (120s)
```

Este orden se alineó con el diagrama de referencia (documento de una identidad —
OCR del documento y biometría facial — antes de la confirmación por OTP). Los TTL
por paso viven exclusivamente en `STEP_TRANSITIONS` de
[session.usecase.ts](../sur-auth-ms-onboarding-session-service/src/app/application/usecases/session.usecase.ts) —
única fuente de verdad de "de qué paso a cuál paso, con qué TTL". El orquestador
nunca decide el próximo paso; le pide a `session-service` `{fromStep, toStep}` vía
`PUT /sessions/{handle}/advance`, y `session-service` valida que esa transición sea
la permitida (si no, `409 STEP_MISMATCH`).

**Nota sobre `password_pending → completed`**: este orquestador implementa el flujo
solo hasta `password_pending` (endpoint `/onboarding/ocr`, último que ejecuta). Los
endpoints `/onboarding/products` y `/onboarding/password` (que en código todavía
referencian el paso legado `password_creation`) **no se usan por ahora** — quedan en
el repositorio sin cambios a la espera de que el otro proceso (fuera de este
workspace) integre su propio mecanismo de selección de productos y creación de
contraseña sobre `session-service`, validando primero el `sessionToken` y luego que
la sesión en Redis esté efectivamente en `password_pending` antes de continuar.

## Diagrama de secuencia

```mermaid
sequenceDiagram
    participant C as Cliente (Web/App)
    participant PA as Preauth Orchestrator
    participant RE as Risk Engine (+ Anti-Bot/hCaptcha)
    participant TS as Token Service
    participant SS as Session Service (Redis)
    participant OO as Onboarding Orchestrator
    participant DE as Device Enrollment (externo)

    C->>PA: POST /pre-auth/context-init (channel, fingerprint, captchaToken)
    PA->>RE: POST /anti-bot/verify (captchaToken, clientIp)
    RE->>RE: hCaptcha /siteverify (real, form-urlencoded)
    RE-->>PA: { success, score, antiBotMetadata }
    PA->>RE: POST /risk/evaluate (fingerprint, channel, antiBotMetadata)
    RE-->>PA: { decision: allow|challenge|deny }
    PA->>TS: POST /tokens/context (channel, fingerprint, clientIp)
    TS-->>PA: contextToken (aud=preauth-api, scope=onboarding:start, jti, TTL 120s)
    PA->>SS: POST /sessions (channel, clientIp, fingerprint)
    SS-->>PA: sessionHandle (step=context_issued, TTL 120s)
    PA-->>C: { contextToken, sessionHandle, expiresIn }

    C->>OO: POST /onboarding/start (Bearer contextToken, sessionHandle, dni)
    OO->>TS: verificar firma/aud contra JWKS (GET /jwks, jose)
    OO->>OO: consumir jti (anti-replay Redis) / generar sub aleatorio (GUID)
    OO->>SS: GET /sessions/{handle}
    SS-->>OO: { step: context_issued, channel, ipHash, ... }
    OO->>SS: PUT /sessions/{handle}/advance (toStep=ocr_pending, metadata: dni,userSub)
    SS->>SS: linkSub(userSub, sessionHandle) — indexa sub:{userSub} -> sessionHandle
    OO->>TS: POST /tokens/session (sessionHandle, channel, clientIp)
    TS-->>OO: sessionToken (aud=onboarding-service, scope=onboarding.active, sub=session:{handle}, TTL 900s)
    OO-->>C: { sessionToken, step: ocr_pending, expiresIn }

    C->>OO: POST /onboarding/ocr (Bearer sessionToken, X-Request-Id, ocrToken)
    OO->>SS: PUT /sessions/{handle}/advance (toStep=face_pending)
    OO-->>C: { step: face_pending }

    C->>OO: POST /onboarding/face (Bearer sessionToken, X-Request-Id, faceToken)
    OO->>SS: PUT /sessions/{handle}/advance (toStep=otp_pending, metadata: otpCode,otpExpiresAt)
    OO-->>C: { step: otp_pending }

    C->>OO: POST /onboarding/otp (Bearer sessionToken, X-Request-Id, otpCode)
    OO->>SS: POST /sessions/{handle}/verify-otp (otpCode)
    SS-->>OO: { valid: true }
    OO->>SS: PUT /sessions/{handle}/advance (toStep=password_pending)
    OO-->>C: { step: password_pending }

    Note over OO,DE: A partir de aquí (products/password) continúa otro proceso, no usado todavía en este repo.
```

## Paso a paso end-to-end — cada punto y su repositorio

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

## Responsabilidades por servicio

### 1. Preauth Orchestrator
- Único endpoint público sin token previo: `POST /pre-auth/context-init`.
- Orquesta, en orden: verificación anti-bot → evaluación de riesgo → emisión de
  `contextToken` → creación de sesión en `session-service`.
- Si el Risk Engine decide `challenge` o `deny`, no se emite `contextToken` ni sesión.
- No tiene base de datos: errores en código (`BUSINESS_ERROR_CODES`).

### 2. Risk Engine (incluye Anti-Bot)
- `POST /anti-bot/verify`: valida el `captchaToken` contra hCaptcha real
  (`POST https://api.hcaptcha.com/siteverify`, form-urlencoded), devuelve
  `success`/`score`/`score_reason`/`hostname` como `AntiBotMetadata` — usados por
  la evaluación de riesgo para tomar la decisión final.
- `POST /risk/evaluate`: combina fingerprint, canal, IP y `antiBotMetadata` recibido
  del paso anterior para producir `allow` | `challenge` | `deny`.
- El módulo anti-bot vive dentro de este mismo servicio (no se separó en otro repo).

### 3. Token Service
- `POST /tokens/context`: emite `contextToken` (aud=`preauth-api`,
  scope=`preauth:onboarding.start`, `jti` single-use, TTL 120s).
- `POST /tokens/session`: emite `sessionToken` (aud=`onboarding-service`,
  scope=`onboarding.active`, `sub=session:{sessionHandle}`, `jti` propio (no usado para
  anti-replay — ver sección de jti más abajo), TTL 900s, multi-uso).
- `GET /jwks`: claves públicas RS256 para verificación remota (usado por
  `onboarding-orchestrator` vía `jose.createRemoteJWKSet`).
- El `contextToken` **no incluye** `sessionHandle` como claim — por eso
  `/onboarding/start` lo recibe explícito en el body.

### 4. Session Service
- State machine sobre Redis: `context_issued` → `otp_pending` → `ocr_pending` →
  `face_pending` → `password_pending` → `completed`.
- TTL por paso + techo absoluto de 900s por sesión (`absoluteExpiresAt`): aunque cada
  paso individual tenga TTL propio, ninguna sesión puede vivir más de 900s en total.
- `POST /sessions`, `GET /sessions/{handle}`, `PUT /sessions/{handle}/advance`,
  `DELETE /sessions/{handle}/invalidate`, `POST /sessions/{handle}/verify-otp`.
- El DNI, el `userSub` generado y el OTP se almacenan como metadata de la sesión
  (`SessionMetadata`), nunca expuestos por `GET` (el OTP solo se valida server-side
  vía `/verify-otp`, que retorna únicamente `{ valid: boolean }`).
- `linkSub(userSub, sessionHandle)`: además de la clave `flow:{sessionHandle}`,
  crea `sub:{userSub}` → `sessionHandle` con el mismo TTL, permitiendo que **cualquier
  servicio con acceso a Redis pueda resolver una sesión directamente por `sub`**, sin
  pasar por HTTP — este es el mecanismo "versátil" que vincula el DNI del cliente a
  su sesión activa en todo el flujo (el `userSub` es aleatorio por sesión, no vinculado
  de forma reversible/determinística al DNI).

### 5. Onboarding Orchestrator
- Orquesta las fases posteriores al pre-auth: `start`, `ocr`, `face`, `otp` (los únicos
  endpoints activos en este repo). `products` y `password` existen en código pero no se
  usan todavía.
- `POST /onboarding/start`: único paso protegido por `contextToken`. Verifica firma/aud/scope
  contra el JWKS real de Token Service, consume el `jti` contra Redis (anti-replay single-use),
  valida el DNI, genera `sub = randomUUID()` (aleatorio, no derivado del DNI),
  avanza la sesión a `ocr_pending` y emite el `sessionToken`.
- Los 3 pasos restantes activos están protegidos por `sessionToken` **y** un header
  `X-Request-Id` obligatorio y de un solo uso (el `sessionToken` es multi-uso durante 900s,
  por lo que el anti-replay por-paso depende de este header, consumido contra Redis vía
  `SET NX EX`).
- Cada paso valida: firma/aud/scope/`sub` del token, binding de IP y canal contra lo emitido
  originalmente, y que el paso actual de la sesión coincida con el esperado (`fase3Guard`).
- El OTP se genera en `/onboarding/face` (transición `face_pending → otp_pending`), no en
  `/onboarding/start` — porque en el orden vigente `otp_pending` queda después de la
  biometría facial.
- No tiene base de datos propia: usa Redis solo para anti-replay (vía `ReplayStorePort`), y
  delega todo el estado de negocio a `session-service`.

## Firma de tokens: llaves RS256 y JWKS

Sí está cubierto — `token-service` es el único servicio que firma tokens, y lo hace con
un par de llaves asimétrico (privada/pública) RS256:

- **Llave privada**: usada solo por `token-service` para firmar (`jwt.sign(..., { algorithm: 'RS256', keyid })`).
  En código actual se lee de variables de entorno como PEM en base64
  (`TOKEN_PRIVATE_KEY_B64` vía `ClientConstants.tokenPrivateKeyB64`) — esto es un
  **placeholder de desarrollo**. El comentario en el propio código
  ([jwtSigner.ts](../sur-auth-ms-onboarding-token-service/src/app/infrastructure/auth/jwtSigner.ts))
  deja explícito que en producción debe resolverse desde un KMS/HSM (Azure Key Vault, AWS KMS)
  y la firma debe delegarse al SDK del proveedor — la llave privada nunca debe residir en
  memoria del proceso ni en variables de entorno en un ambiente productivo.
- **Llave pública**: se expone en `GET /jwks` (sin autenticación, es información pública)
  como un JWK (`{ kty: 'RSA', use: 'sig', alg: 'RS256', kid, n, e }`), generado a partir de
  la llave pública PEM vía `crypto.createPublicKey(...).export({ format: 'jwk' })`.
- **`kid` (key id)**: cada JWT firmado incluye un `kid` en su header, y el JWKS expone la
  llave pública correspondiente a ese `kid`. Esto permite rotar llaves sin invalidar tokens
  ya emitidos (mientras el JWKS siga sirviendo la llave vieja durante su período de gracia).
- **Verificación (lado consumidor)**: `onboarding-orchestrator` nunca decodifica un JWT sin
  validar su firma. Usa la librería `jose`:
  `createRemoteJWKSet(new URL(TOKEN_SERVICE_JWKS_URL))` + `jwtVerify(token, jwks, { audience })`.
  `jose` cachea el JWKS y lo refresca automáticamente cuando encuentra un `kid` desconocido
  (p. ej. tras una rotación de llaves), sin que se necesite reiniciar el servicio consumidor.
  Si la firma no es válida, expiró, o el `aud` no coincide con el esperado, se lanza
  `INVALID_TOKEN` (401) — nunca se continúa el flujo con un token no verificado.

En resumen: sí existe la generación/gestión de llave pública y privada para firmar y
validar los tokens (RS256 + JWKS), tal como aparece en el recuadro del diagrama de
referencia ("RS256 · KMS/HSM"). Lo único pendiente para producción es reemplazar el
placeholder de variables de entorno por la integración real con un KMS/HSM.

## jti y anti-replay: un solo uso vs multi-uso

También está cubierto, con dos mecanismos distintos según el tipo de token:

1. **`contextToken` → single-use por `jti`**. Cada `contextToken` emitido por
   `token-service` incluye un claim `jti` (UUID único, ver `token.usecase.ts`).
   Cuando `onboarding-orchestrator` recibe `/onboarding/start`, después de verificar la
   firma:
   - Intenta `SET ctx:jti:{jti} 1 EX {ttl} NX` en Redis (`ReplayStorePort.consumeOnce`).
   - Si la clave **ya existía** (`NX` falla) → el token ya fue canjeado antes → `401 TOKEN_REPLAY`.
   - Si la clave **no existía** → se registra y el flujo continúa. Un segundo intento con el
     mismo `contextToken` (mismo `jti`) siempre será rechazado, incluso si el JWT en sí
     todavía no expiró (TTL 120s) — así se refuerza el single-use más allá de solo el `exp`.
2. **`sessionToken` → multi-uso, con anti-replay por `X-Request-Id`, no por `jti`**.
   El `sessionToken` también incluye su propio `jti` (para trazabilidad/logging en
   `token-service`), pero **no se usa como mecanismo de anti-replay** porque el mismo
   `sessionToken` se reutiliza en los pasos siguientes (`ocr`, `face`, `otp`) durante toda
   su vida (900s) — si se consumiera el `jti` en el primer paso, los pasos siguientes
   fallarían. Por eso cada paso exige, además del `sessionToken`, un header `X-Request-Id`
   (UUID generado por el cliente en cada intento), que sí se consume de forma single-use
   contra Redis (`SET req:{sessionHandle}:{requestId} 1 EX 30 NX`):
   - Si el cliente reintenta un paso con el mismo `X-Request-Id` (p. ej. por un timeout y un
     reintento automático) → `409 REQUEST_REPLAYED`.
   - Un nuevo intento legítimo del mismo paso debe generar un `X-Request-Id` nuevo.

Esto coincide con el patrón del diagrama de referencia: `EXISTS ctx:jti:{jti}` para el
contextToken (rama "Sí existe → 401 replay") y `EXISTS req:{requestId}` para cada paso de
onboarding (rama "Sí existe → 401 request_replayed" — en esta implementación se modela
como `409 REQUEST_REPLAYED` en vez de 401, ya que semánticamente es un conflicto de
idempotencia y no un problema de autenticación).

## Redis compartido

Ambos `session-service` y `onboarding-orchestrator` usan la **misma instancia** de Redis:

```
redis://default:***@retrocozy-volleyball-trade-50215.db.redis.io:15759
```

- `session-service`: estado de la sesión (`flow:{sessionHandle}`) e índice cruzado por
  `sub` (`sub:{userSub}`).
- `onboarding-orchestrator`: anti-replay de `jti` del `contextToken` (`ctx:jti:{jti}`,
  TTL 120s) y de `X-Request-Id` por paso (`req:{sessionHandle}:{requestId}`, TTL 30s).

## Seguridad — decisiones clave

- **JWT real, no `jwt.decode()`**: `onboarding-orchestrator` verifica firma RS256 y
  audiencia contra el JWKS remoto de `token-service` usando `jose` (`createRemoteJWKSet`
  + `jwtVerify`), nunca decodifica sin validar.
- **hCaptcha real**: `risk-engine` llama a `https://api.hcaptcha.com/siteverify` con
  `application/x-www-form-urlencoded` (incompatible con el `HttpClientService` JSON-only
  compartido, por eso tiene su propio `HCaptchaClient` sobre el módulo `https` nativo).
- **OTP nunca expuesto por HTTP**: la validación ocurre enteramente dentro de
  `session-service` (`POST /verify-otp` devuelve solo `{ valid: boolean }`).
- **Anti-replay en dos niveles**: `jti` del `contextToken` (single-use, un solo canje
  posible) y `X-Request-Id` por cada llamada a un paso de `onboarding-orchestrator`
  (el `sessionToken` en sí es multi-uso durante toda la sesión).
- **Techo absoluto de sesión**: 900 segundos totales, sin importar cuántos pasos TTL
  individuales se acumulen — evita que una sesión se extienda indefinidamente.
- **DNI y `sub`**: el DNI se almacena en Redis como metadata de sesión (no en el
  `sessionToken`, que solo lleva `sub=session:{sessionHandle}`); el `sub` es un GUID
  aleatorio generado por sesión (no derivado del DNI) usado como identificador para
  lookup cruzado entre servicios.

## Patrones compartidos entre repos

- Arquitectura hexagonal: `domain` / `application/ports` (`input`/`output`) /
  `application/usecases` / `infrastructure` (`clients`, `di`, `auth`, `cache`) /
  `presentation/http` (`controllers`, `dto`, `schema`) / `routers` / `config` / `shared`.
- DI con `tsyringe` (`container.register` / `registerSingleton` / `registerInstance` +
  objeto `DI_TOKENS` de strings).
- Fastify 5.x + `@darwin-node/composer`, validación con JSON Schema nativo (sin Zod).
- Cada repo mantiene su propia copia local de los contratos compartidos
  (`ports/output/contracts/*.ts`) — no existe un paquete npm compartido entre servicios.
- Dos estilos de manejo de errores conviven en el ecosistema: BD-backed
  (`ErrorCatalogService`, usado por `risk-engine`/`token-service`/`session-service`) y
  en-código (`BUSINESS_ERROR_CODES`, usado por los dos orquestadores, que no tienen BD).

## Comparación con el diagrama de referencia

Contraste entre `01-preauth-token-exchange 1.png` y lo implementado en este workspace:

**Coincide exactamente**:
- Fase 1 (pre-auth gate): Cliente → Preauth Orchestrator → Anti-bot → Risk Engine →
  (si `allow`) Token Service emite `contextToken` → Session Service crea la sesión → se
  devuelve `{ contextToken, sessionHandle }` al cliente.
- Claims del `contextToken`: `aud=preauth-api`, `scope=preauth:onboarding.start`, `jti`
  (UUID), `channel`, TTL 120s, firmado RS256 vía KMS/HSM (placeholder de env vars en este
  código, ver sección de llaves más arriba).
- Claims del `sessionToken`: `aud=onboarding-service`, `sub=session:{handle}`, `channel`,
  TTL 900s (15 min), firmado RS256.
- Anti-replay de `contextToken` por `jti` contra Redis (`EXISTS`/`SET NX EX`), y
  anti-replay por request en los pasos de onboarding (`EXISTS req:{requestId}` /
  `SET req:{id} 1 EX ttl`).
- `GET /jwks` para verificación de firmas sin contactar a Token Service en cada request.
- **El paso `otp_pending` entre `context_issued` y `ocr_pending`**: el diagrama de
  referencia lo incluye, y desde la última revisión de este documento la implementación
  ya lo replica (`context_issued → otp_pending → ocr_pending → face_pending →
  password_pending → completed`). Anteriormente este documento dejaba constancia de una
  divergencia intencional (sin OCR, OTP antes de biometría) — esa decisión se revirtió.

**Difiere (y por qué)**:
- El diagrama muestra `scope=onboarding:active` con `:` y el código de `token-service`
  emite `onboarding.active` con `.` — se documentó el valor real del código (fuente de
  verdad en runtime) en este MD y se corrigió `onboarding-orchestrator` para validar
  exactamente ese valor (antes verificaba `onboarding:steps`, un valor que nunca iba a
  coincidir — bug corregido durante la redacción de este documento).
- El diagrama incluye un `WAF + API Gateway` como capa de entrada (TLS 1.3, reglas OWASP
  CRS, rate limiting) y un `SIEM` para eventos de seguridad. Ninguno de los dos es un
  repositorio de este workspace — son infraestructura externa (Gateway/WAF gestionado por
  la plataforma, SIEM como destino de logs). Este documento no los modela como servicios
  propios; `preauth-orchestrator` asume que ya pasó por esa capa (recibe `X-Correlation-Id`
  ya propagado).
- El diagrama muestra un `nonce` como parte del payload inicial del cliente en Fase 1
  (junto a `fingerprint`/`channel`). La implementación actual de `preauth-orchestrator`
  no incluye un campo `nonce` explícito en `ContextInitRequest` — el `fingerprint` y el
  `jti` del `contextToken` cumplen un rol de unicidad equivalente en este flujo, pero si
  se requiere el campo `nonce` explícito del cliente (por ejemplo, para atar el request de
  anti-bot a un valor generado en el dispositivo antes de resolver el captcha), es un
  campo adicional a agregar en `ContextInitRequest` y en el schema de body correspondiente.
- **`sessionHandle` y `channel` viajan como headers en el diagrama, no en el body.** El
  diagrama muestra explícitamente `X-Session-Handle: {handle}` y `X-Client-Channel` como
  headers en `POST /onboarding/start` (y presumiblemente en los pasos de Fase 3). La
  implementación actual de `onboarding-orchestrator` los recibe en el **body** JSON
  (`StartBodyDto.sessionHandle`, y el `channel` no se recibe del cliente en absoluto —
  se toma del `session.channel` ya almacenado en Redis vía Session Service). Ambos
  enfoques son válidos funcionalmente (el body cumple el mismo propósito), pero si se
  requiere alinear 1:1 con el diagrama (p. ej. por convención de que identificadores de
  sesión/routing van en headers y no en el payload de negocio), es un cambio acotado al
  controller (`onboarding.controller.ts`, leer de `req.headers['x-session-handle']` en
  vez de `req.body.sessionHandle`) y a los schemas de request correspondientes.
- **El diagrama muestra al WAF + API Gateway validando la firma del `contextToken` en una
  "CAPA1" antes de reenviar la petición** (`CAPA1 · Firma RS256 JWKS(TS) · exp ·
  aud=preauth-api`, con `401` devuelto ahí mismo si la firma es inválida). Esta es una
  capa de defensa adicional en el borde de la red (edge validation), redundante con la
  verificación que ya hace `onboarding-orchestrator` internamente (`jose` +
  `createRemoteJWKSet`). Como el WAF/API Gateway es infraestructura externa a este
  workspace (ver punto anterior sobre WAF/SIEM), esta doble validación no está — ni puede
  estar — implementada en ninguno de los 5 repos; solo existe la validación que hace
  `onboarding-orchestrator` mismo. Esto no es un defecto funcional (la firma sí se valida,
  una sola vez, correctamente) pero sí una capa de seguridad "en profundidad" del diagrama
  que no aplica a este workspace por estar fuera de su alcance.

