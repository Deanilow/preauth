export interface TransferEmailTemplate {
  templateId: string;
  subject: string;
  requiredParams: string[];
  optionalParams?: string[];
}

export const TRANSFER_EMAIL_TEMPLATES: Record<string, TransferEmailTemplate> = {
  'transferencia-creacion-favorito-app-surgir': {
    templateId: 'd-a55e1854bff54cdbbc05b107df4625d2',
    subject: 'Creaste un favorito en tu app Surgir',
    requiredParams: ['OPERATION_NUMBER', 'FAVORITE_NAME', 'TRANSFER_TYPE', 'OPERATION_DATE', 'TRANSFER_DESTINATION_ACCOUNT'],
  },
  'transferencia-entre-cuentas-propias-detalle-favorito-app-surgir': {
    templateId: 'd-ad2f20dc36b248c78efdb50637894e84',
    subject: 'Realizaste una transferencia entre tus cuentas',
    requiredParams: ['OPERATION_NUMBER', 'TRANSFER_AMOUNT_INTEGER', 'TRANSFER_AMOUNT_DECIMAL', 'TRANSFER_COMPLETED_DATE', 'TRANSFER_TYPE', 'TRANSFER_SOURCE_ACCOUNT', 'TRANSFER_DESTINATION_ACCOUNT'],
    optionalParams: ['TRANSFER_DETAIL', 'TRANSFER_FAVORITE_NAME'],
  },
  'transferencia-entre-cuentas-surgir-detalle-favorito-app-surgir': {
    templateId: 'd-f327fdb94ef64affa440916823c9cabb',
    subject: 'Realizaste una transferencia entre cuentas Surgir',
    requiredParams: ['OPERATION_NUMBER', 'TRANSFER_AMOUNT_INTEGER', 'TRANSFER_AMOUNT_DECIMAL', 'TRANSFER_COMPLETED_DATE', 'TRANSFER_TYPE', 'TRANSFER_SOURCE_ACCOUNT', 'CLIENT_NAME_DESTINATION_ACCOUNT', 'TRANSFER_DESTINATION_ACCOUNT'],
    optionalParams: ['TRANSFER_DETAIL', 'TRANSFER_FAVORITE_NAME'],
  },
  'transferencia-entre-cuentas-surgir-superior-30k-detalle-favorito-app-surgir': {
    templateId: 'd-1e0e901d39f044208c154b15a52da3f1',
    subject: 'Realizaste una transferencia entre cuentas Surgir',
    requiredParams: ['OPERATION_NUMBER', 'TRANSFER_AMOUNT_INTEGER', 'TRANSFER_AMOUNT_DECIMAL', 'TRANSFER_COMPLETED_DATE', 'COMMISSION_AMOUNT', 'TRANSFER_TOTAL_AMOUNT', 'TRANSFER_TYPE', 'TRANSFER_SOURCE_ACCOUNT', 'CLIENT_NAME_DESTINATION_ACCOUNT', 'TRANSFER_DESTINATION_ACCOUNT'],
    optionalParams: ['TRANSFER_DETAIL', 'TRANSFER_FAVORITE_NAME'],
  },
};

export type TransferTemplateKey = keyof typeof TRANSFER_EMAIL_TEMPLATES;

type TemplateResolver = (amount: number) => TransferTemplateKey;

export const TRANSFER_TEMPLATE_RESOLVER: Partial<Record<string, TemplateResolver>> = {
  TRANSFER_OWN_ACCOUNTS: () =>
    'transferencia-entre-cuentas-propias-detalle-favorito-app-surgir',
};