import { ContextInitRequest } from './pre-auth.request';
import { ContextInitResponse } from './pre-auth.response';

export interface PreAuthInputPort {
  contextInit(req: ContextInitRequest): Promise<ContextInitResponse>;
}
