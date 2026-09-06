import { inject, injectable } from 'tsyringe';
import { HttpClientService } from '../http/http-client.service';
import { ClientConstants } from './client.constants';
import { ClientHeadersFactory } from './headers.factory.client';
import { BaseClient } from './base.client';
import { AntiBotVerifyRequest, AntiBotVerifyResponse } from '../../../app/application/ports/output/contracts/anti-bot';

@injectable()
export class AntiBotClient extends BaseClient {
  constructor(
    @inject('HttpClientService') httpClient: HttpClientService
  ) {
    super(
      httpClient,
      ClientConstants.antiBotBaseUrl,
      ClientConstants.antiBotTimeoutMs,
      'AntiBotService'
    );
  }

  async verify(payload: AntiBotVerifyRequest): Promise<AntiBotVerifyResponse> {
    return this.executeRequestApi(
      'POST',
      '/verify',
      ClientHeadersFactory.create({ Authorization: `Bearer ${ClientConstants.serviceApiKey}` }),
      payload
    );
  }
}
