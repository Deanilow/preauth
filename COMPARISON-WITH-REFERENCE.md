# Comparación con el diagrama de referencia

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
