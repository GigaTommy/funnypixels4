export interface FlagItem {
  id: string;
  name: string;
  pattern_id: string;
  color: string;
  description?: string;
}

export interface Alliance {
  id: string;
  name: string;
  description?: string;
  flag_pattern_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AllianceMember {
  id: string;
  alliance_id: string;
  user_id: string;
  role: 'leader' | 'member';
  joined_at: string;
}