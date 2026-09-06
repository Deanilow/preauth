export const DI_TOKENS = {

  // ─── Notifications ────────────────────────────────────────────────────────────

  // ─── Anti-bot ─────────────────────────────────────────────────────────────────
  AntiBotInputPort: 'AntiBotInputPort',
  AntiBotController: 'AntiBotController',  HCaptchaClient: 'HCaptchaClient',
  // ─── Risk Engine ──────────────────────────────────────────────────────────────
  RiskInputPort: 'RiskInputPort',
  RiskController: 'RiskController',
  RiskStatePort: 'RiskStatePort',

  // ─── Infrastructure ───────────────────────────────────────────────────────────
  HttpClientService: 'HttpClientService',

  // ─── Auth ─────────────────────────────────────────────────────────────────────

  // ─── Clients ──────────────────────────────────────────────────────────────────


  // ─── Repositories ─────────────────────────────────────────────────────────────

  // ─── Adapters ─────────────────────────────────────────────────────────────────

  // ─── Services ─────────────────────────────────────────────────────────────────

  // ─── Legacy ───────────────────────────────────────────────────────────────────


} as const;