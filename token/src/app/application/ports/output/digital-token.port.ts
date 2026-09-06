export interface JwksResult {
  keys: Array<{
    kty: string;
    use: string;
    alg: string;
    kid: string;
    n: string;
    e: string;
  }>;
}

export interface DigitalTokenSignerOutputPort {
  sign(payload: Record<string, unknown>, expiresInSeconds: number): Promise<string>;
  getJwks(): JwksResult;
}
