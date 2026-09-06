import { NotificationChannel } from './notification-channel.enum';
import { NotificationType } from './notification-type.enum';

type ParamResolver = (params: Record<string, string>) => string;

export interface NotificationTemplate {
  channel: NotificationChannel;
  emailTemplateId?: string;
  emailSubject?: string | ParamResolver;
  hasAttachment?: boolean;
  pushTitle?: string | ParamResolver;
  pushBody?: string | ParamResolver;
}

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {

  // ─── Auth ──────────────────────────────────────────────────────────────────
  PASSWORD_CREATED: {
    channel: NotificationChannel.EMAIL_AND_PUSH,
    emailTemplateId: 'd-aaa111',
    emailSubject: 'Creaste tu contraseña para tu app Surgir',
    pushTitle: 'Contraseña creada',
    pushBody: (p) => `Hola ${p.CUSTOMER_NAME}, creaste tu contraseña exitosamente.`,
  },
  DEVICE_LINKED: {
    channel: NotificationChannel.EMAIL_AND_PUSH,
    emailTemplateId: 'd-bbb222',
    emailSubject: 'Vinculaste un nuevo dispositivo a tu app Surgir',
    pushTitle: 'Nuevo dispositivo vinculado',
    pushBody: (p) => `Dispositivo ${p.DEVICE_NAME} vinculado.`,
  },
  PASSWORD_RESET: {
    channel: NotificationChannel.EMAIL_AND_PUSH,
    emailTemplateId: 'd-ccc333',
    emailSubject: 'Creaste una nueva contraseña para tu app Surgir',
    pushTitle: 'Contraseña actualizada',
    pushBody: () => 'Tu contraseña fue actualizada exitosamente.',
  },
  ACCESS_BLOCKED: {
    channel: NotificationChannel.EMAIL_AND_PUSH,
    emailTemplateId: 'd-ddd444',
    emailSubject: 'Bloqueaste el acceso a tu app',
    pushTitle: 'Acceso bloqueado',
    pushBody: () => 'El acceso a tu app fue bloqueado.',
  },
  BIOMETRIC_ANDROID: {
    channel: NotificationChannel.PUSH,
    pushTitle: 'Biometría activada',
    pushBody: (p) => `Hola ${p.CUSTOMER_NAME}, activaste la biometría en Android.`,
  },
  BIOMETRIC_IOS: {
    channel: NotificationChannel.PUSH,
    pushTitle: 'Biometría activada',
    pushBody: (p) => `Hola ${p.CUSTOMER_NAME}, activaste la biometría en iOS.`,
  },

  // ─── Transfers — emailTemplateId lo resuelve TransferHandler ───────────────
  TRANSFER_OWN_ACCOUNTS: {
    channel: NotificationChannel.EMAIL,
    pushTitle: 'Transferencia realizada',
    pushBody: (p) => `Transferiste ${p.CURRENCY} ${p.AMOUNT} a tu cuenta ${p.DESTINATION_ACCOUNT}.`,
  },

  // ─── Profile ───────────────────────────────────────────────────────────────
  EMAIL_UPDATED: {
    channel: NotificationChannel.EMAIL_AND_PUSH,
    emailTemplateId: 'd-hhh888',
    emailSubject: 'Actualización de correo electrónico',
    pushTitle: 'Correo actualizado',
    pushBody: (p) => `Tu correo fue actualizado a ${p.NEW_EMAIL}.`,
  },
  PHONE_UPDATED: {
    channel: NotificationChannel.EMAIL_AND_PUSH,
    emailTemplateId: 'd-iii999',
    emailSubject: 'Actualización de celular principal',
    pushTitle: 'Celular actualizado',
    pushBody: (p) => `Tu celular fue actualizado a ${p.NEW_PHONE}.`,
  },
  PASSWORD_CHANGED: {
    channel: NotificationChannel.EMAIL_AND_PUSH,
    emailTemplateId: 'd-jjj000',
    emailSubject: 'Cambio de contraseña',
    pushTitle: 'Contraseña cambiada',
    pushBody: () => 'Tu contraseña fue cambiada exitosamente.',
  },
  TRANSFER_LIMIT_UPDATED: {
    channel: NotificationChannel.EMAIL_AND_PUSH,
    emailTemplateId: 'd-kkk111',
    emailSubject: 'Límite de transferencias actualizado',
    pushTitle: 'Límite actualizado',
    pushBody: (p) => `Tu límite es ahora ${p.CURRENCY} ${p.NEW_LIMIT}.`,
  },

  // ─── Enriched ──────────────────────────────────────────────────────────────
  STATEMENT_PDF: {
    channel: NotificationChannel.EMAIL,
    emailTemplateId: 'd-bae5b17ec592477ebc3ada3d6cd822d0',
    emailSubject: (p) => `Tu Cronograma de pago ya esta disponible!`,
    hasAttachment: true,
  },
};