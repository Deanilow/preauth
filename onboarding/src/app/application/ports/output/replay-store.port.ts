/**
 * Puerto de anti-replay sobre Redis. Reemplaza el `TTLStore` en memoria del
 * script de referencia: mismas claves lógicas (`ctx:jti:*`, `req:*`) pero
 * persistidas en Redis real, compartido con Session Service.
 */
export interface ReplayStorePort {
  /**
   * Marca `jti` como consumido. Devuelve `true` si es la primera vez (uso permitido),
   * `false` si ya se había consumido antes (replay).
   */
  consumeOnce(key: string, ttlSeconds: number): Promise<boolean>;
}
