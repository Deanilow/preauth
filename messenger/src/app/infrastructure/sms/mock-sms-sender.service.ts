import { singleton } from 'tsyringe';
import { SmsSenderPort } from '../../application/ports/output/sms-sender.port';
import { logger } from 'app/infrastructure/logger';

/**
 * Envío de OTP al celular SIMULADO: no se integra un proveedor real (SMS/WhatsApp).
 * Solo registra en logs que el código "se envió" al dispositivo vinculado a la sesión.
 */
@singleton()
export class MockSmsSenderService implements SmsSenderPort {
  async send(sessionHandle: string, code: string): Promise<void> {
    logger.info(
      { sessionHandle, code, provider: 'mock-sms' },
      '[Messenger] SMS simulado: código OTP "enviado" al celular del cliente',
    );
  }
}
