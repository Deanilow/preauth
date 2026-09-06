import { inject, injectable } from 'tsyringe';
import { HttpClientService } from '../http/http-client.service';
import { ClientConstants } from './client.constants';
import { ClientHeadersFactory } from './headers.factory.client';
import { BaseClient } from './base.client';
import { CreateSessionRequest, CreateSessionResponse } from '../../../app/application/ports/output/contracts/session-service';

@injectable()
export class SessionServiceClient extends BaseClient {
  constructor(
    @inject('HttpClientService') httpClient: HttpClientService
  ) {
    super(
      httpClient,
      ClientConstants.sessionServiceBaseUrl,
      ClientConstants.sessionServiceTimeoutMs,
      'SessionService'
    );
  }

  async createSession(payload: CreateSessionRequest): Promise<CreateSessionResponse> {
    return this.executeRequestApi(
      'POST',
      '/sessions',
      ClientHeadersFactory.create({ Authorization: `Bearer ${ClientConstants.serviceApiKey}` }),
      payload
    );
  }
}
