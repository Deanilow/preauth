import { inject, injectable } from 'tsyringe';
import { HttpClientService } from '../http/http-client.service';
import { ClientConstants } from './client.constants';
import { ClientHeadersFactory } from './headers.factory.client';
import { BaseClient } from './base.client';
import { EmitSessionTokenRequest, EmitTokenResponse } from '../../application/ports/output/contracts/token-service';

@injectable()
export class TokenServiceClient extends BaseClient {
  constructor(
    @inject('HttpClientService') httpClient: HttpClientService,
  ) {
    super(
      httpClient,
      ClientConstants.tokenServiceBaseUrl,
      ClientConstants.tokenServiceTimeoutMs,
      'TokenService',
    );
  }

  /** Emite el sessionToken (aud=onboarding-service) usado por todos los pasos de Fase 3. */
  async issueSessionToken(payload: EmitSessionTokenRequest): Promise<EmitTokenResponse> {
    return this.executeRequestApi(
      'POST',
      '/tokens/session',
      ClientHeadersFactory.create({ Authorization: `Bearer ${ClientConstants.serviceApiKey}` }),
      payload,
    );
  }
}
