import { inject, injectable } from 'tsyringe';
import { createHash } from 'crypto';
import { PreAuthInputPort } from '../ports/input/pre-auth.input';
import { ContextInitRequest } from '../ports/input/pre-auth.request';
import { ContextInitResponse } from '../ports/input/pre-auth.response';
import { AntiBotVerifyResponse } from '../ports/output/contracts/anti-bot';
import { RiskEvaluateResponse } from '../ports/output/contracts/risk-engine';
import { logger } from 'app/infrastructure/logger';
import { AntiBotClient } from 'app/infrastructure/clients/anti-bot.client';
import { RiskEngineClient } from 'app/infrastructure/clients/risk-engine.client';
import { TokenServiceClient } from 'app/infrastructure/clients/token-service.client';
import { SessionServiceClient } from 'app/infrastructure/clients/session-service.client';
import { BusinessError } from 'src/shared/errors/integration.error';

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

interface FlowDefinition {
  /** Exige `context.captchaToken` y ejecuta la verificación anti-bot. */
  requiresAntiBot: boolean;
  /** Exige `context.fingerprint` y ejecuta la evaluación de riesgo. */
  requiresRisk: boolean;
  /** Campos obligatorios dentro de `context` para este flujo. */
  requiredContext: string[];
}

/**
 * Registry de flujos soportados por context-init. Para agregar un flujo nuevo,
 * se suma una entrada acá (y su definición en session-service). No hace falta
 * tocar el schema del body: los datos del flujo van en `context`.
 */
const FLOW_DEFINITIONS: Record<string, FlowDefinition> = {
  appclient: { requiresAntiBot: true, requiresRisk: true, requiredContext: ['fingerprint', 'captchaToken'] },
  onboarding: { requiresAntiBot: true, requiresRisk: false, requiredContext: ['captchaToken'] },
  otp_only: { requiresAntiBot: false, requiresRisk: false, requiredContext: ['deviceUuid'] },
};

@injectable()
export class PreAuthUseCase implements PreAuthInputPort {
  constructor(
    @inject('AntiBotClient')
    private readonly antiBotClient: AntiBotClient,
    @inject('RiskEngineClient')
    private readonly riskEngineClient: RiskEngineClient,
    @inject('TokenServiceClient')
    private readonly tokenServiceClient: TokenServiceClient,
    @inject('SessionServiceClient')
    private readonly sessionServiceClient: SessionServiceClient,
  ) { }

  async contextInit(req: ContextInitRequest): Promise<ContextInitResponse> {
    const flow = FLOW_DEFINITIONS[req.flowType];
    if (!flow) {
      throw new BusinessError('REQUEST_VALIDATION_ERROR', `Unknown flowType '${req.flowType}'`);
    }

    // Validación de los campos requeridos por el flujo (dentro de context).
    for (const field of flow.requiredContext) {
      const value = req.context?.[field];
      if (value === undefined || value === null || value === '') {
        throw new BusinessError('REQUEST_VALIDATION_ERROR', `context.${field} is required for flow '${req.flowType}'`);
      }
    }

    const deviceId = this.resolveDeviceId(req.context);

    if (flow.requiresAntiBot) {
      const antiBot = await this.verifyAntiBot(req);
      if (flow.requiresRisk) {
        await this.evaluateRisk(req, antiBot, deviceId);
      }
    }

    return this.issueContext(req, deviceId);
  }

  /** Identificador de dispositivo: fingerprint > deviceUuid > hash(captchaToken). */
  private resolveDeviceId(context: Record<string, unknown>): string {
    const { fingerprint, deviceUuid, captchaToken } = context ?? {};
    if (typeof fingerprint === 'string' && fingerprint) return fingerprint;
    if (typeof deviceUuid === 'string' && deviceUuid) return deviceUuid;
    if (typeof captchaToken === 'string' && captchaToken) return sha256Hex(captchaToken);
    throw new BusinessError('REQUEST_VALIDATION_ERROR', 'context.fingerprint, context.deviceUuid or context.captchaToken is required');
  }

  private async verifyAntiBot(req: ContextInitRequest): Promise<AntiBotVerifyResponse> {
    const result = await this.antiBotClient.verify({
      channel: req.channel,
      captchaToken: req.context.captchaToken as string,
      clientIp: req.clientIp,
    });

    if (!result.verified) {
      logger.warn({ correlationId: req.correlationId }, '[PreAuth] bot_detected');
      throw new BusinessError('BOT_DETECTED');
    }

    return result;
  }

  private async evaluateRisk(req: ContextInitRequest, antiBot: AntiBotVerifyResponse, deviceId: string): Promise<RiskEvaluateResponse> {
    const result = await this.riskEngineClient.evaluate({
      clientIp: req.clientIp,
      fingerprint: deviceId,
      userAgent: req.userAgent,
      channel: req.channel,
      antiBotScore: antiBot.score,
      antiBotMetadata: antiBot.metadata,
      correlationId: req.correlationId,
    });

    if (result.decision === 'deny') {
      throw new BusinessError('RISK_DENIED');
    }
    if (result.decision === 'challenge') {
      throw new BusinessError('CHALLENGE_REQUIRED');
    }

    return result;
  }

  private async issueContext(req: ContextInitRequest, deviceId: string): Promise<ContextInitResponse> {
    const [tokenBody, sessionBody] = await Promise.all([
      this.tokenServiceClient.issueContextToken({
        channel: req.channel,
        clientIp: req.clientIp,
        correlationId: req.correlationId,
      }),
      this.sessionServiceClient.createSession({
        flowType: req.flowType,
        channel: req.channel,
        clientIp: req.clientIp,
        context: req.context,
        correlationId: req.correlationId,
      }),
    ]);

    logger.info({ correlationId: req.correlationId, sessionHandle: sessionBody.sessionHandle, flowType: req.flowType }, '[PreAuth] context-init OK');

    return {
      contextToken: tokenBody.token,
      sessionHandle: sessionBody.sessionHandle,
      expiresIn: tokenBody.expiresIn,
    };
  }
}
