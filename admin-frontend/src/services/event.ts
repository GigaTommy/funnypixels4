
import request from './request'

export interface Event {
    id: string
    title: string
    description?: string
    type: 'leaderboard' | 'territory_control' | 'cooperation'
    start_time: string
    end_time: string
    status: 'draft' | 'published' | 'active' | 'ended'
    config?: any
    banner_url?: string
    created_at?: string
    updated_at?: string
}

export interface EventListParams {
    current?: number
    pageSize?: number
    status?: string
}

export const eventService = {
    getEvents: async (params: EventListParams) => {
        const response = await request.get('/admin/events', { params })
        return response.data.data
    },

    getEvent: async (id: string) => {
        const response = await request.get(`/admin/events/${id}`)
        return response.data.data
    },

    createEvent: async (data: Partial<Event>) => {
        const response = await request.post('/admin/events', data)
        return response.data.data
    },

    updateEvent: async (id: string, data: Partial<Event>) => {
        const response = await request.put(`/admin/events/${id}`, data)
        return response.data.data
    },

    deleteEvent: async (id: string) => {
        const response = await request.delete(`/admin/events/${id}`)
        return response.data.data
    },

    // Get event statistics for dashboard
    getEventStats: async () => {
        const response = await request.get('/admin/events/stats')
        return response.data.data
    },

    // Get event participants
    getParticipants: async (eventId: string, params?: { page?: number; pageSize?: number; type?: string }) => {
        const response = await request.get(`/admin/events/${eventId}/participants`, { params })
        return response.data.data
    },

    // Get event rankings
    getRankings: async (eventId: string) => {
        const response = await request.get(`/admin/events/${eventId}/rankings`)
        return response.data.data
    },

    // Get event result
    getEventResult: async (eventId: string) => {
        const response = await request.get(`/admin/events/${eventId}/result`)
        return response.data.data
    },

    // Manually settle event
    settleEvent: async (eventId: string) => {
        const response = await request.post(`/admin/events/${eventId}/settle`)
        return response.data.data
    }
}
