import { api } from './api';

export interface BadgeCounts {
  map: { hasActivity: boolean };
  feed: { count: number };
  alliance: { count: number };
  leaderboard: { rankChanged: boolean };
  profile: { count: number };
}

export class BadgeAPI {
  static async getBadgeCounts(): Promise<BadgeCounts> {
    const response = await api.get('/badges');
    return response.data.data;
  }
}
