import { singleton } from 'tsyringe';
import { OtpProviderPort } from '../../application/ports/output/otp-provider.port';
import { logger } from 'app/infrastructure/logger';

/**
 * Proveedor de OTP SIMULADO: este servicio NO genera ni valida el código real.
 * El "otro servicio" (integración externa) es quien genera y valida. Acá solo
 * se simula la llamada para que el flujo quede completo.
 */
@singleton()
export class MockOtpProviderService implements OtpProviderPort {
  async generate(sessionHandle: string): Promise<void> {
    logger.info({ sessionHandle, provider: 'mock-otp-provider' }, '[Messenger] OTP generate delegado a otro servicio (simulado)');
  }

  async verify(sessionHandle: string, otpCode: string): Promise<boolean> {
    logger.info({ sessionHandle, provider: 'mock-otp-provider' }, '[Messenger] OTP verify delegado a otro servicio (simulado)');
    // Simulación: siempre válido. El servicio real de OTP decidirá si coincide.
    return otpCode.length === 6;
  }
}
