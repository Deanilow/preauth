export interface ErrorItem {
  code: string;
  message: string;
  level: string;
  description?: string;
}

export interface ErrorResponse {
  error: ErrorItem;
}