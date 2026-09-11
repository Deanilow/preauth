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
solo hasta `password_pending` (endpoint `/onboarding/face`, último que ejecuta). Los
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
    OO->>SS: PUT /sessions/{handle}/advance (toStep=otp_pending, metadata: dni,userSub)
    SS->>SS: linkSub(userSub, clientInfo) — indexa sub:{userSub} -> {sessionHandle, dni, fingerprint}
    OO->>TS: POST /tokens/session (sessionHandle, channel, clientIp)
    TS-->>OO: sessionToken (aud=onboarding-service, scope=onboarding:steps, sub=session:{handle}, TTL 900s)
    OO-->>C: { sessionToken, step: otp_pending, expiresIn }

    C->>OO: POST /onboarding/otp (Bearer sessionToken, X-Request-Id)
    Note over OO: El proceso externo valida el OTP (no este orquestador)
    OO->>SS: PUT /sessions/{handle}/advance (toStep=ocr_pending)
    OO-->>C: { step: ocr_pending }

    C->>OO: POST /onboarding/ocr (Bearer sessionToken, X-Request-Id)
    OO->>SS: PUT /sessions/{handle}/advance (toStep=face_pending)
    OO-->>C: { step: face_pending }

    C->>OO: POST /onboarding/face (Bearer sessionToken, X-Request-Id)
    OO->>SS: PUT /sessions/{handle}/advance (toStep=password_pending)
    OO-->>C: { step: password_pending }

    Note over OO,DE: A partir de aquí (products/password) continúa otro proceso, no usado todavía en este repo.
```

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
  `success`/`score`/`score_reason`/`hostname`/`challenge_ts`/`pass` como
  `AntiBotMetadata` (preparado para Enterprise/Pro: `botScore`, `botScoreReason`,
  `rawBotScore`, `scoreLevel`, `pass`) — usados por la evaluación de riesgo.
- `POST /risk/evaluate`: combina reputación IP, velocity por `clientIp` (ventana 5 min),
  historial del `fingerprint` (`fingerprintKnown`/`newDevice`/`travelAnomaly`/
  `userAgentConsistent`) y `deviceMetadata` nativo (Play Integrity / DeviceCheck) junto
  con la `antiBotMetadata` completa, para producir `allow` | `challenge` | `deny`.
  El `fingerprint` sí puntúa (devuelto en `signals` del contrato).
- El módulo anti-bot vive dentro de este mismo servicio (no se separó en otro repo).
- Contrato OpenAPI: `risk/api/swagger/openapi.yaml`.

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
- El DNI, el `userSub` generado y (cuando el proceso externo lo provea) el OTP se almacenan
  como metadata de la sesión. El OTP nunca se expone en `GET`; su validación la realiza
  otro proceso vía `POST /verify-otp`, que retorna únicamente `{ valid: boolean }`.
- `linkSub(userSub, clientInfo)`: además de la clave `flow:{sessionHandle}`,
  crea `sub:{userSub}` → **proyección del cliente** (`sessionHandle`, `userSub`, `dni`,
  `fingerprint`) con el mismo TTL. Permite que **cualquier servicio con acceso a Redis
  obtenga los datos del cliente directamente por `sub`** con UNA sola lectura, sin
  pasar por HTTP ni conocer `flow:{sessionHandle}`. Este es el mecanismo "versátil" que
  vincula el DNI del cliente a su sesión activa en todo el flujo (el `userSub` es
  aleatorio por sesión, no vinculado de forma reversible/determinística al DNI).

### 5. Onboarding Orchestrator
- Orquesta las fases posteriores al pre-auth: `start`, `otp`, `ocr`, `face` (los únicos
  endpoints activos en este repo). `products` y `password` existen en código pero no se
  usan todavía.
- `POST /onboarding/start`: único paso protegido por `contextToken`. Verifica firma/aud/scope
  contra el JWKS real de Token Service, consume el `jti` contra Redis (anti-replay single-use),
  valida el DNI, genera `sub = randomUUID()` (aleatorio, no derivado del DNI),
  avanza la sesión a `otp_pending` y emite el `sessionToken`. No genera el OTP (eso lo hace
  el proceso externo que valida el código).
- Los pasos restantes activos están protegidos por `sessionToken` **y** un header
  `X-Request-Id` obligatorio y de un solo uso (el `sessionToken` es multi-uso durante 900s,
  por lo que el anti-replay por-paso depende de este header, consumido contra Redis vía
  `SET NX EX`).
- Cada paso valida: firma/aud/scope/`sub` del token, binding de IP y canal contra lo emitido
  originalmente, y que el paso actual de la sesión coincida con el esperado (`fase3Guard`).
- El OTP lo genera y valida un **proceso externo** (no este orquestador). El orquestador
  solo avanza la state machine (`context_issued → otp_pending → ocr_pending → face_pending`
  → `password_pending`), validando firma/aud/scope/sub del token, binding de IP y canal, y
  que el paso actual coincida (`fase3Guard`). Los endpoints `/onboarding/otp`, `/ocr` y
  `/face` reciben únicamente `sessionHandle`.
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

- `session-service`: estado de la sesión (`flow:{sessionHandle}`) e índice por
  `sub` (`sub:{userSub}` → proyección `{sessionHandle, dni, fingerprint, userSub}`).
- `onboarding-orchestrator`: anti-replay de `jti` del `contextToken` (`ctx:jti:{jti}`,
  TTL 120s) y de `X-Request-Id` por paso (`req:{sessionHandle}:{requestId}`, TTL 30s).

## Seguridad — decisiones clave

- **JWT real, no `jwt.decode()`**: `onboarding-orchestrator` verifica firma RS256 y
  audiencia contra el JWKS remoto de `token-service` usando `jose` (`createRemoteJWKSet`
  + `jwtVerify`), nunca decodifica sin validar.
- **hCaptcha real**: `risk-engine` llama a `https://api.hcaptcha.com/siteverify` con
  `application/x-www-form-urlencoded` (incompatible con el `HttpClientService` JSON-only
  compartido, por eso tiene su propio `HCaptchaClient` sobre el módulo `https` nativo).
  La metadata Enterprise/Pro (`score`, `score_reason`, `hostname`, `challenge_ts`,
  `pass`) alimenta el score. Sin `HCAPTCHA_SECRET` cae en modo `bypass` (penalizado).
- **fingerprint sí puntúa**: el Risk Engine mantiene historial por `fingerprint` y deriva
  `fingerprintKnown`, `newDevice`, `travelAnomaly` (mismo fingerprint visto desde otra IP)
  y `userAgentConsistent`; el velocity se calcula por `clientIp`. La `deviceMetadata`
  nativa (Play Integrity / DeviceCheck) aporta la señal de integridad de dispositivo.
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
