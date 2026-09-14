
# Sistema de Errores

## Visión general

Esta API consume múltiples servicios externos. Los errores pueden originarse en cualquier capa:

Cliente móvil
      ↓
[portfolio-query-api]  ← esta API
      ↓                   ↓                      ↓                        ↓                     ↓
CustomerAccountPosition  AccountBalancesTransactions  IdentityAccess  TransactionalTransfers  DocumentInformation
      ↓
cobis-loans-int (proveedor bancario final)

Todo error, sin importar su origen, pasa por buildErrorWrapper(error) en el catch de cada use case.

## Contrato de respuesta de error

- El código HTTP es la fuente de verdad del estado.
- El body de error contiene solo errors.
- Ya no se devuelve status dentro del body.

Ejemplo de error:

HTTP 409

{
  "errors": [
    {
      "code": "COB-BIZ-201004",
      "message": "No encontramos la cuenta indicada.",
      "level": "error",
      "description": "..."
    }
  ]
}

---

## Fuente de verdad: tabla error_catalog

Los mensajes al cliente, HTTP status y clasificación viven en BD. Cambiar un mensaje no requiere deploy.

| campo | descripción | ejemplo |
|---|---|---|
| error_code | código devuelto al cliente | TRF-BNS-001 |
| source_code | código numérico del proveedor final | 201004 |
| source_system | sistema de origen | COBIS, POSITION_API |
| service_name | nombre exacto del cliente HTTP | AccountBalancesTransactionsService |
| http_status | HTTP de respuesta al cliente | 409 |
| client_message | mensaje visible al cliente, nunca datos técnicos | |

---

## Modelo de resolución (híbrido)

Este sistema es híbrido, no 100% BD:

1. Primero intenta en BD (source_code por source_system).
2. Si no encuentra, intenta búsqueda cruzada por source_code en otros source_system (prioridad COBIS).
3. Si no encuentra, intenta en BD por error_code.
4. Si no encuentra, usa fallback del proveedor definido para BD.
5. **Si no encuentra, intenta fallback de infraestructura del servicio** (defensivo).
6. Si aún no encuentra nada, usa fallback hardcodeado en código.

Orden de resolución real:

1. getBySourceCode(sourceSystem, code)
2. getBySourceCode(candidateSystem, code) en búsqueda cruzada
3. getByCode(code)
4. getByCode(PROVIDER_FALLBACK_CODE[sourceSystem])
5. **getByCode(SERVICE_UNAVAILABLE_CODE_MAP[serviceName])** ← Nuevo: fallback defensivo por infraestructura
6. HARDCODED_FALLBACK

Nota:

- La búsqueda cruzada existe porque en la práctica hay catálogos combinados con source_code heredados (por ejemplo códigos COBIS) que pueden llegar desde un servicio intermedio.
- La prioridad COBIS evita perder mapeos globales de negocio como COB-BIZ-* cuando el code original es numérico.
- El **paso 5 (nuevo)** es defensivo: si un servicio devuelve un código genérico como `UNEXPECTED_ERROR`, busca su fallback de infraestructura (ej: `AccountBalancesTransactionsService` → `TXN-UNV-001`). Esto evita que errores sin estructura se pierdan y asegura mensajes contextualmente relevantes al cliente.

---

## Servicios registrados

| service_name (en super) | source_system en BD | fallback infraestructura | fallback negocio |
|---|---|---|---|
| CustomerAccountPositionService | POSITION_API | POS-UNV-001 | POS-BIZ-001 |
| AccountBalancesTransactionsService | BALANCE_TRANSACTIONS_API | TXN-UNV-001 | TXN-BIZ-001 |
| IdentityAccessService | IDENTITY_API | IDN-UNV-001 | IDN-BIZ-001 |
| TransactionalTransfersService | INTERNAL_TRANSACTIONS_API | TRF-UNV-001 | TRF-BIZ-001 |
| DocumentInformationService | DOCUMENT_INFORMATION_API | DOC-UNV-001 | DOC-BIZ-001 |

---

## Reglas de negocio

Regla acordada:

- Toda regla de negocio responde HTTP 422 de forma general.

Notas:

- Si existen códigos de negocio históricos con otros estados (por ejemplo 400, 404, 409), deben migrarse en la tabla error_catalog para mantener consistencia.
- La política final de estado la define http_status en BD.

---

## Fallback defensivo de infraestructura (Nuevo)

Cuando un servicio externo devuelve un error sin estructura clara (como `UNEXPECTED_ERROR`), el sistema ahora es defensivo y busca automáticamente el código de infraestructura no disponible (UNV) del servicio.

**Propósito**: Evitar que errores genéricos del upstream se pierdan, asegurando mensajes contextualmente correctos.

**Ejemplo práctico**:
- `RoleSelectionClient` (en account-position) timeout
  - account-position retorna: `{ code: 'COB-AUTH-UNV-001', status: 503 }`
  - query-api recibe IntegrationError con `sourceName='CustomerAccountPositionService'`
  - Intenta resolver `COB-AUTH-UNV-001` en su catálogo
  - Si no existe localmente, usa paso 5: `SERVICE_UNAVAILABLE_CODE_MAP['CustomerAccountPositionService'] = 'POS-UNV-001'`
  - Retorna al cliente: `POS-UNV-001` en lugar de `UNEXPECTED_ERROR` ✓

**Cómo funciona en el código**:
```typescript
// resolveCode recibe serviceName como 4to parámetro
const resolved = resolveCode(firstCode, catalog, sourceSystem, ie.sourceName);

// Dentro de resolveCode, después de fallback de proveedor:
if (serviceName) {
  const serviceUnavailableCode = SERVICE_UNAVAILABLE_CODE_MAP[serviceName];
  if (serviceUnavailableCode) {
    const serviceUnavailable = catalog?.getByCode(serviceUnavailableCode);
    if (serviceUnavailable) return serviceUnavailable;  // ← Encontró UNV ✓
  }
}
```

---

## Tipos de error

### 1) BusinessError

Se lanza desde use case para reglas de negocio y se resuelve por catálogo.

Flujo:

throw new BusinessError(...)
  → buildErrorWrapper
  → resolveCode(...)
  → retorna código/mensaje desde BD

### 2) IntegrationError caso A

Upstream devuelve errors con code o source_code.

Flujo:

errors/code upstream
  → resolveCode(code, catalog, sourceSystem, serviceName)
  → intenta paso 1-3
  → fallback del proveedor (paso 4)
  → **fallback defensivo de infraestructura por serviceName (paso 5)**
  → hardcoded fallback si nada funciona

Ejemplo: `AccountBalancesTransactionsService` devuelve `{ errors: [{ code: 'UNEXPECTED_ERROR' }] }`
- Paso 1-3 fallan (código genérico no mapeado)
- Paso 4: Busca `TXN-BIZ-001` (fallback de negocio)
- Paso 5: Si no existe, busca `TXN-UNV-001` (fallback de infraestructura por servicio) ✓
- Retorna el código UNV apropiado al cliente

### 3) IntegrationError caso B

Proveedor devuelve error legacy (error array).

Flujo:

error/code upstream
  → resolveCode(...)
  → **incluye fallback defensivo de infraestructura (paso 5)**
  → fallback del proveedor si no hay match

### 4) IntegrationError caso C

Timeout o red sin body reconocible.

Flujo:

service_name
  → lookup por servicio
  → fallback de infraestructura
  → hardcoded fallback si no hay nada

### 5) Error inesperado

Error no clasificado:

UNEXPECTED_ERROR
  → BD
  → hardcoded fallback si no hay catálogo

---

## Dónde manejar catch

Decisión recomendada:

- Mantener catch en use case para centralizar normalización de errores de negocio/integración.
- El controller debe manejar validaciones de entrada y auth del request HTTP.

Motivo:

- Evita duplicar lógica de mapeo en múltiples controllers.
- Conserva una sola puerta de salida para errores de dominio (buildErrorWrapper).

---

## Caché

- Al arrancar: load hace 1 query a BD y llena caché.
- Claves por entrada: ec:code, ec:src, ec:svc.
- TTL: ERROR_CATALOG_TTL_MS (default 10 horas).
- Lookup O(1) desde memoria.
- Al expirar TTL: recarga en el siguiente buildErrorWrapper.

---

## Cómo integrar algo nuevo

### Nuevo BusinessError

1. Definir código de negocio en integration.error.ts.
2. Registrar fila en error_catalog con http_status 422.
3. Lanzar BusinessError desde use case.

### Nuevo proveedor / cliente HTTP

1. Registrar service_name en el cliente (super(..., serviceName)).
2. Crear entradas de catálogo en BD para:
   - indisponibilidad del servicio
   - fallback de negocio del proveedor
3. Ajustar mapas de código solo si aplica (modelo híbrido).

### Cambiar mensaje al cliente

Actualizar client_message en error_catalog.

### Renombrar un cliente HTTP

1. Cambiar service_name en super.
2. Actualizar service_name en BD.
3. Ajustar mapas en código si corresponde.


