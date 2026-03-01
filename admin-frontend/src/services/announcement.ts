import request from './request';
import type { PaginationResponse, PaginationParams, ApiResponse } from '@/types';

export interface Announcement {
    id: string;
    author_id: string;
    author_name?: string;
    title: string;
    content: string;
    type: 'global' | 'system' | 'alliance';
    alliance_id?: number;
    is_active: boolean;
    is_pinned: boolean;
    priority: number;
    display_style: 'none' | 'marquee' | 'popup';
    publish_at: string;
    expire_at?: string;
    created_at: string;
    updated_at: string;
}

export const announcementService = {
    getAnnouncements: (params?: PaginationParams & { type?: string; is_active?: boolean }) =>
        request.get<ApiResponse<PaginationResponse<Announcement>>>('/admin/announcements', { params }),

    createAnnouncement: (data: Partial<Announcement>) =>
        request.post<ApiResponse<Announcement>>('/admin/announcements', data),

    updateAnnouncement: (id: string, data: Partial<Announcement>) =>
        request.put<ApiResponse<Announcement>>(`/admin/announcements/${id}`, data),

    deleteAnnouncement: (id: string) =>
        request.delete<ApiResponse<any>>(`/admin/announcements/${id}`),
};
