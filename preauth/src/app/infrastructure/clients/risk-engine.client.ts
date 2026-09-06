import { inject, injectable } from 'tsyringe';
import { HttpClientService } from '../http/http-client.service';
import { ClientConstants } from './client.constants';
import { ClientHeadersFactory } from './headers.factory.client';
import { BaseClient } from './base.client';
import { RiskEvaluateRequest, RiskEvaluateResponse } from '../../../app/application/ports/output/contracts/risk-engine';

@injectable()
export class RiskEngineClient extends BaseClient {
  constructor(
    @inject('HttpClientService') httpClient: HttpClientService
  ) {
    super(
      httpClient,
      ClientConstants.riskEngineBaseUrl,
      ClientConstants.riskEngineTimeoutMs,
      'RiskEngineService'
    );
  }

  async evaluate(payload: RiskEvaluateRequest): Promise<RiskEvaluateResponse> {
    return this.executeRequestApi(
      'POST',
      '/evaluate',
      ClientHeadersFactory.create({ Authorization: `Bearer ${ClientConstants.serviceApiKey}` }),
      payload
    );
  }
}
