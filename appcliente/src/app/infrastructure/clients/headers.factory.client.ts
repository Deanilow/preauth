export class ClientHeadersFactory {
  static create(extra: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...extra,
    };
  }
}