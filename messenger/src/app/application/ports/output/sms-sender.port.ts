/**
 * Puerto de envío del OTP al celular (SMS/WhatsApp).
 * En esta versión es SIMULADO: no se integra un proveedor real; solo se registra.
 */
export interface SmsSenderPort {
  send(sessionHandle: string, code: string): Promise<void>;
}
