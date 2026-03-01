// chat_messages 种子数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('chat_messages').del();
  
  // 插入种子数据
  await knex('chat_messages').insert([
    {
      'id': 1,
      'sender_id': '661bdcc1-b4dd-4c76-8c73-7331a80732e0',
      'content': '这是一条测试全局消息',
      'room': 'global',
      'created_at': '2025-09-02T08:46:46.349Z',
      'channel_type': 'global',
      'channel_id': null,
      'metadata': {},
      'is_system_message': false,
      'is_deleted': false,
      'deleted_at': null,
      'updated_at': '2025-09-02T08:46:46.349Z'
    },
    {
      'id': 2,
      'sender_id': 'd2a6c9c0-10d3-4e5f-a307-d8d05e9f4ba2',
      'content': 'ces',
      'room': 'global',
      'created_at': '2025-09-02T08:51:46.693Z',
      'channel_type': 'global',
      'channel_id': null,
      'metadata': {},
      'is_system_message': false,
      'is_deleted': false,
      'deleted_at': null,
      'updated_at': '2025-09-02T08:51:46.693Z'
    },
    {
      'id': 3,
      'sender_id': 'd2a6c9c0-10d3-4e5f-a307-d8d05e9f4ba2',
      'content': 'test',
      'room': 'global',
      'created_at': '2025-09-02T08:51:56.770Z',
      'channel_type': 'global',
      'channel_id': null,
      'metadata': {},
      'is_system_message': false,
      'is_deleted': false,
      'deleted_at': null,
      'updated_at': '2025-09-02T08:51:56.770Z'
    }
  ]);
  
  console.log('✅ chat_messages: 插入了 3 条记录');
};