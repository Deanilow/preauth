import { inject, injectable } from 'tsyringe';
import { HttpClientService } from '../http/http-client.service';
import { ClientConstants } from './client.constants';
import { ClientHeadersFactory } from './headers.factory.client';
import { BaseClient } from './base.client';
import { ContextTokenRequest, ContextTokenResponse } from '../../../app/application/ports/output/contracts/token-service';

@injectable()
export class TokenServiceClient extends BaseClient {
  constructor(
    @inject('HttpClientService') httpClient: HttpClientService
  ) {
    super(
      httpClient,
      ClientConstants.tokenServiceBaseUrl,
      ClientConstants.tokenServiceTimeoutMs,
      'TokenService'
    );
  }

  async issueContextToken(payload: ContextTokenRequest): Promise<ContextTokenResponse> {
    return this.executeRequestApi(
      'POST',
      '/tokens/context',
      ClientHeadersFactory.create({ Authorization: `Bearer ${ClientConstants.serviceApiKey}` }),
      payload
    );
  }
}
