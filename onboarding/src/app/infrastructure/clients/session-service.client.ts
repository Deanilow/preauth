import { inject, injectable } from 'tsyringe';
import { HttpClientService } from '../http/http-client.service';
import { ClientConstants } from './client.constants';
import { ClientHeadersFactory } from './headers.factory.client';
import { BaseClient } from './base.client';
import {
  AdvanceStepRequest,
  SessionStateResponse,
  VerifyOtpResponse,
} from '../../application/ports/output/contracts/session-service';

@injectable()
export class SessionServiceClient extends BaseClient {
  constructor(
    @inject('HttpClientService') httpClient: HttpClientService,
  ) {
    super(
      httpClient,
      ClientConstants.sessionServiceBaseUrl,
      ClientConstants.sessionServiceTimeoutMs,
      'SessionService',
    );
  }

  async getSession(sessionHandle: string, correlationId: string): Promise<SessionStateResponse> {
    return this.executeRequestApi(
      'GET',
      `/sessions/${sessionHandle}`,
      ClientHeadersFactory.create({
        Authorization: `Bearer ${ClientConstants.serviceApiKey}`,
        'x-correlation-id': correlationId,
      }),
    );
  }

  async advanceStep(sessionHandle: string, payload: AdvanceStepRequest, correlationId: string): Promise<SessionStateResponse> {
    return this.executeRequestApi(
      'PUT',
      `/sessions/${sessionHandle}/advance`,
      ClientHeadersFactory.create({
        Authorization: `Bearer ${ClientConstants.serviceApiKey}`,
        'x-correlation-id': correlationId,
      }),
      payload,
    );
  }

  async verifyOtp(sessionHandle: string, otpCode: string, correlationId: string): Promise<VerifyOtpResponse> {
    return this.executeRequestApi(
      'POST',
      `/sessions/${sessionHandle}/verify-otp`,
      ClientHeadersFactory.create({
        Authorization: `Bearer ${ClientConstants.serviceApiKey}`,
        'x-correlation-id': correlationId,
      }),
      { otpCode },
    );
  }
}
