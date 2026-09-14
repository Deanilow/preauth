import { inject, injectable } from 'tsyringe';
import { HttpClientService } from '../http/http-client.service';
import { ClientConstants } from './client.constants';
import { ClientHeadersFactory } from './headers.factory.client';
import { BaseClient } from './base.client';
import {
  GenerateOtpRequest,
  GenerateOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '../../application/ports/output/contracts/messenger';

/**
 * Cliente hacia Messenger Service — genera y verifica el código OTP de la sesión.
 */
@injectable()
export class MessengerClient extends BaseClient {
  constructor(
    @inject('HttpClientService') httpClient: HttpClientService,
  ) {
    super(
      httpClient,
      ClientConstants.messengerBaseUrl,
      ClientConstants.messengerTimeoutMs,
      'MessengerService',
    );
  }

  async generateOtp(sessionHandle: string, sessionToken: string, correlationId: string): Promise<GenerateOtpResponse> {
    const payload: GenerateOtpRequest = { sessionHandle };
    return this.executeRequestApi(
      'POST',
      '/otp/generate',
      ClientHeadersFactory.create({
        Authorization: `Bearer ${sessionToken}`,
        'x-correlation-id': correlationId,
      }),
      payload,
    );
  }

  async verifyOtp(sessionHandle: string, otpCode: string, sessionToken: string, correlationId: string): Promise<VerifyOtpResponse> {
    const payload: VerifyOtpRequest = { sessionHandle, otpCode };
    return this.executeRequestApi(
      'POST',
      '/otp/verify',
      ClientHeadersFactory.create({
        Authorization: `Bearer ${sessionToken}`,
        'x-correlation-id': correlationId,
      }),
      payload,
    );
  }
}
