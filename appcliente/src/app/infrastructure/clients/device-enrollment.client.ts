import { inject, injectable } from 'tsyringe';
import { HttpClientService } from '../http/http-client.service';
import { ClientConstants } from './client.constants';
import { ClientHeadersFactory } from './headers.factory.client';
import { BaseClient } from './base.client';
import { EnrollDeviceRequest, EnrollDeviceResponse } from '../../application/ports/output/contracts/device-enrollment';

/**
 * Cliente hacia Device Enrollment Service — servicio externo (otro repo/equipo),
 * no implementado en este workspace. Solo se consume su contrato.
 */
@injectable()
export class DeviceEnrollmentClient extends BaseClient {
  constructor(
    @inject('HttpClientService') httpClient: HttpClientService,
  ) {
    super(
      httpClient,
      ClientConstants.deviceEnrollmentBaseUrl,
      ClientConstants.deviceEnrollmentTimeoutMs,
      'DeviceEnrollmentService',
    );
  }

  async enroll(payload: EnrollDeviceRequest): Promise<EnrollDeviceResponse> {
    return this.executeRequestApi(
      'POST',
      '/devices/enroll',
      ClientHeadersFactory.create({ Authorization: `Bearer ${ClientConstants.serviceApiKey}` }),
      payload,
    );
  }
}
