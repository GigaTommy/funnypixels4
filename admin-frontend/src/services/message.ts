import request from './request';
import type { PaginationResponse, PaginationParams, ApiResponse } from '@/types';

export interface SystemMessage {
    id: string;
    sender_id: string;
    receiver_id?: string;
    receiver_name?: string;
    title: string;
    content: string;
    attachments?: any;
    type: 'notification' | 'reward' | 'activity';
    is_read: boolean;
    read_at?: string;
    expires_at?: string;
    created_at: string;
}

export const messageService = {
    sendMail: (data: {
        title: string;
        content: string;
        receiver_id?: string | 'all';
        attachments?: any;
        type?: string;
        expires_at?: string;
    }) => request.post<ApiResponse<SystemMessage>>('/admin/system-messages/send', data),

    getSentMails: (params?: PaginationParams) =>
        request.get<ApiResponse<PaginationResponse<SystemMessage>>>('/admin/system-messages/sent', { params }),
};
