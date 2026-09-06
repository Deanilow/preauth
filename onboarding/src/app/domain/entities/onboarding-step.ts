export type OnboardingStep =
  | 'context_issued'
  | 'otp_pending'
  | 'ocr_pending'
  | 'face_pending'
  | 'password_pending'
  | 'completed';
