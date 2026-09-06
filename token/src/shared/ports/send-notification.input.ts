import { NotificationType } from 'src/shared/notifications/domain/notification-type.enum';

export interface SendNotificationInput {
    type: NotificationType;
    context: Record<string, string>;
    jwtCode: string;
    jwt: string;
}

export interface ResolvedNotification {
    recipientEmail?: string;
    params: Record<string, string>;
    attachment?: { filename: string; content: string; type: string };
    emailTemplateId?: string;   
    emailSubject?: string;    
}