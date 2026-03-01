// wallet_ledger 种子数据
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('wallet_ledger').del();
  
  // 插入种子数据
  await knex('wallet_ledger').insert([
    {
      'id': 'c3a46fab-cbcd-4258-8f31-c4bfd6aecaec',
      'user_id': 'd2a6c9c0-10d3-4e5f-a307-d8d05e9f4ba2',
      'delta_points': 10000,
      'reason': '充值订单 d567da8d-ad7b-4786-a35a-743d91e5c457',
      'ref_id': 'd567da8d-ad7b-4786-a35a-743d91e5c457',
      'created_at': '2025-09-06T13:30:20.050Z',
    },
    {
      'id': '189d8c99-75e2-4981-b703-e9473707d55e',
      'user_id': 'd2a6c9c0-10d3-4e5f-a307-d8d05e9f4ba2',
      'delta_points': 0,
      'reason': '购买商品',
      'ref_id': '78',
      'created_at': '2025-09-06T13:30:20.050Z',
    },
    {
      'id': 'c9d43785-1e1f-42fc-9511-ecf2db936ab7',
      'user_id': 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
      'delta_points': 4000,
      'reason': '充值订单 cc5f53a8-5fbc-4237-be90-da55a4967b48',
      'ref_id': 'cc5f53a8-5fbc-4237-be90-da55a4967b48',
      'created_at': '2025-09-06T13:30:20.050Z',
    },
    {
      'id': '62c94ade-1116-4873-97f3-f19b43c1bc10',
      'user_id': 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
      'delta_points': 0,
      'reason': '购买商品',
      'ref_id': '78',
      'created_at': '2025-09-06T13:30:20.050Z',
    },
    {
      'id': '13a1237f-8b5a-4c3c-b2c2-cdff26ac3a06',
      'user_id': 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
      'delta_points': 0,
      'reason': '购买商品',
      'ref_id': '82',
      'created_at': '2025-09-06T13:30:20.050Z',
    },
    {
      'id': '72a068df-08ef-4ad2-a454-4ed384f398f3',
      'user_id': 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
      'delta_points': 0,
      'reason': '购买商品',
      'ref_id': '83',
      'created_at': '2025-09-06T13:30:20.050Z',
    },
    {
      'id': 'd1496f51-01c1-4b1f-bc75-a57c30a3e109',
      'user_id': 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
      'delta_points': 0,
      'reason': '购买商品',
      'ref_id': '76',
      'created_at': '2025-09-06T13:30:20.050Z',
    },
    {
      'id': 'c936bfa2-ac58-4046-8ddf-4013a3245a2b',
      'user_id': 'a79a1fbe-0f97-4303-b922-52b35e6948d5',
      'delta_points': 0,
      'reason': '购买商品',
      'ref_id': '83',
      'created_at': '2025-09-06T13:30:20.050Z',
    }
  ]);
  
  console.log('✅ wallet_ledger: 插入了 8 条记录');
};