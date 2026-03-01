// user_pixel_states 种子数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('user_pixel_states').del();
  
  // 插入种子数据
  await knex('user_pixel_states').insert([
    {
      'id': 38,
      'user_id': 'd2a6c9c0-10d3-4e5f-a307-d8d05e9f4ba2',
      'pixel_points': 64,
      'last_accum_time': '1756831689',
      'freeze_until': '0',
      'created_at': '2025-09-02T08:49:17.686Z',
      'updated_at': '2025-09-02T16:48:09.725Z',
      'item_pixel_points': 0,
      'natural_pixel_points': 64,
      'max_natural_pixel_points': 64,
      'last_activity_time': '1756805477',
      'is_in_natural_accumulation': true
    },
    {
      'id': 39,
      'user_id': 'guest_dc37560f-03ed-44f2-86f5-bfa90edb3499',
      'pixel_points': 64,
      'last_accum_time': '1756831697',
      'freeze_until': '0',
      'created_at': '2025-09-02T16:48:17.189Z',
      'updated_at': '2025-09-02T16:48:17.189Z',
      'item_pixel_points': 0,
      'natural_pixel_points': 64,
      'max_natural_pixel_points': 64,
      'last_activity_time': '1756831697',
      'is_in_natural_accumulation': false
    },
    {
      'id': 34,
      'user_id': 'fe89a000-5f45-4118-aa99-46e6985bc519',
      'pixel_points': 64,
      'last_accum_time': '1756802774',
      'freeze_until': '0',
      'created_at': '2025-09-02T08:46:14.224Z',
      'updated_at': '2025-09-02T08:46:14.224Z',
      'item_pixel_points': 0,
      'natural_pixel_points': 64,
      'max_natural_pixel_points': 64,
      'last_activity_time': '1756802774',
      'is_in_natural_accumulation': false
    },
    {
      'id': 35,
      'user_id': '661bdcc1-b4dd-4c76-8c73-7331a80732e0',
      'pixel_points': 64,
      'last_accum_time': '1756802774',
      'freeze_until': '0',
      'created_at': '2025-09-02T08:46:14.405Z',
      'updated_at': '2025-09-02T08:46:14.405Z',
      'item_pixel_points': 0,
      'natural_pixel_points': 64,
      'max_natural_pixel_points': 64,
      'last_activity_time': '1756802774',
      'is_in_natural_accumulation': false
    },
    {
      'id': 36,
      'user_id': '0180c670-e3bb-4cbf-a876-0095105eecc8',
      'pixel_points': 64,
      'last_accum_time': '1756802774',
      'freeze_until': '0',
      'created_at': '2025-09-02T08:46:14.415Z',
      'updated_at': '2025-09-02T08:46:14.415Z',
      'item_pixel_points': 0,
      'natural_pixel_points': 64,
      'max_natural_pixel_points': 64,
      'last_activity_time': '1756802774',
      'is_in_natural_accumulation': false
    },
    {
      'id': 37,
      'user_id': 'guest_f29ad97a-e98e-46c1-ae33-1f3aadea7a3e',
      'pixel_points': 64,
      'last_accum_time': '1756802922',
      'freeze_until': '0',
      'created_at': '2025-09-02T08:48:42.537Z',
      'updated_at': '2025-09-02T08:48:42.537Z',
      'item_pixel_points': 0,
      'natural_pixel_points': 64,
      'max_natural_pixel_points': 64,
      'last_activity_time': '1756802922',
      'is_in_natural_accumulation': false
    },
    {
      'id': 40,
      'user_id': 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
      'pixel_points': 55,
      'last_accum_time': '1757063565',
      'freeze_until': '0',
      'created_at': '2025-09-02T16:48:52.583Z',
      'updated_at': '2025-09-05T09:12:45.015Z',
      'item_pixel_points': 0,
      'natural_pixel_points': 55,
      'max_natural_pixel_points': 64,
      'last_activity_time': '1757063456',
      'is_in_natural_accumulation': true
    },
    {
      'id': 42,
      'user_id': 'guest_a43ce840-688d-4e39-acf4-f5ab6a00f4f8',
      'pixel_points': 64,
      'last_accum_time': '1757063569',
      'freeze_until': '0',
      'created_at': '2025-09-05T09:12:49.546Z',
      'updated_at': '2025-09-05T09:12:49.546Z',
      'item_pixel_points': 0,
      'natural_pixel_points': 64,
      'max_natural_pixel_points': 64,
      'last_activity_time': '1757063569',
      'is_in_natural_accumulation': false
    },
    {
      'id': 43,
      'user_id': 'guest_bf355e1a-0df1-4219-be6b-42689271c74a',
      'pixel_points': 64,
      'last_accum_time': '1757064020',
      'freeze_until': '0',
      'created_at': '2025-09-05T09:20:20.389Z',
      'updated_at': '2025-09-05T09:20:20.389Z',
      'item_pixel_points': 0,
      'natural_pixel_points': 64,
      'max_natural_pixel_points': 64,
      'last_activity_time': '1757064020',
      'is_in_natural_accumulation': false
    },
    {
      'id': 41,
      'user_id': 'guest_b6d93664-0e44-4494-b5ce-ced9512dfe34',
      'pixel_points': 64,
      'last_accum_time': '1756831934',
      'freeze_until': '0',
      'created_at': '2025-09-02T16:52:14.736Z',
      'updated_at': '2025-09-02T16:52:14.736Z',
      'item_pixel_points': 0,
      'natural_pixel_points': 64,
      'max_natural_pixel_points': 64,
      'last_activity_time': '1756831934',
      'is_in_natural_accumulation': false
    }
  ]);
  
  console.log('✅ user_pixel_states: 插入了 10 条记录');
};