import { inject, injectable } from 'tsyringe';
import { HttpClientService } from '../http/http-client.service';
import { ClientConstants } from './client.constants';
import { ClientHeadersFactory } from './headers.factory.client';
import { BaseClient } from './base.client';
import { SessionStateResponse } from '../../application/ports/output/contracts/session-service';

/**
 * Cliente hacia Session Service — solo para validar el paso actual de la sesión.
 */
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
}
