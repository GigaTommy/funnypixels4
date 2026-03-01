// recharge_orders 种子数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('recharge_orders').del();
  
  // 插入种子数据
  await knex('recharge_orders').insert([
    {
      'id': 'd567da8d-ad7b-4786-a35a-743d91e5c457',
      'user_id': 'd2a6c9c0-10d3-4e5f-a307-d8d05e9f4ba2',
      'amount_rmb': '500.00',
      'points': 10000,
      'channel': 'mock',
      'status': 'paid',
      'idempotency_key': 'recharge_d2a6c9c0-10d3-4e5f-a307-d8d05e9f4ba2_1756803028131_6qb4xn9',
      'created_at': '2025-09-06T13:30:20.048Z',
      'paid_at': '2025-09-02T08:50:31.610Z'
    },
    {
      'id': 'cc5f53a8-5fbc-4237-be90-da55a4967b48',
      'user_id': 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
      'amount_rmb': '200.00',
      'points': 4000,
      'channel': 'mock',
      'status': 'paid',
      'idempotency_key': 'recharge_a79a1fbe-0f97-4303-b922-52b35e6948d5_1757032508503_idfceyk',
      'created_at': '2025-09-06T13:30:20.048Z',
      'paid_at': '2025-09-05T00:35:12.172Z'
    }
  ]);
  
  console.log('✅ recharge_orders: 插入了 2 条记录');
};