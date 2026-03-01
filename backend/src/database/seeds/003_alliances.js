// alliances 种子数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('alliances').del();
  
  // 插入种子数据
  await knex('alliances').insert([
    {
      'id': 8,
      'name': '太阳联盟',
      'description': '太阳联盟',
      'color': '#000000',
      'leader_id': 'd2a6c9c0-10d3-4e5f-a307-d8d05e9f4ba2',
      'is_public': true,
      'member_count': 0,
      'created_at': '2025-09-02T09:08:08.264Z',
      'updated_at': '2025-09-02T09:08:08.264Z',
      'flag_pattern_id': 'emoji_sun',
      'flag_pattern_anchor_x': 0,
      'flag_pattern_anchor_y': 0,
      'flag_pattern_rotation': 0,
      'flag_pattern_mirror': false,
      'approval_required': false,
      'is_active': true,
      'flag_unicode_char': '☀️',
      'flag_render_type': 'emoji',
      'flag_payload': null
    },
    {
      'id': 9,
      'name': '洋红色联盟',
      'description': '洋红色联盟',
      'color': '#000000',
      'leader_id': 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
      'is_public': true,
      'member_count': 0,
      'created_at': '2025-09-02T16:49:25.951Z',
      'updated_at': '2025-09-02T16:49:25.951Z',
      'flag_pattern_id': 'color_magenta',
      'flag_pattern_anchor_x': 0,
      'flag_pattern_anchor_y': 0,
      'flag_pattern_rotation': 0,
      'flag_pattern_mirror': false,
      'approval_required': false,
      'is_active': true,
      'flag_unicode_char': '🌺',
      'flag_render_type': 'color',
      'flag_payload': null
    }
  ]);
  
  console.log('✅ alliances: 插入了 2 条记录');
};