/**
 * Seed file generated from database dump
 * Table: shop_skus
 * Date: 2026-02-12T11:57:27.574Z
 */

exports.seed = async function(knex) {
  // Deletion policy
  await knex('shop_skus').del();
  
  // Guard: skip if data array is empty
  if (false) return;

  // Insert data in chunks to avoid query size limits
  const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
  const data = [
  {
    "id": 81,
    "name": "红色旗帜",
    "description": "经典红色旗帜",
    "price": 0,
    "currency": "coins",
    "item_type": "flag_color",
    "item_id": 1,
    "is_available": true,
    "created_at": "2025-09-02T08:46:14.495Z",
    "updated_at": "2026-02-01T04:06:07.401Z",
    "image_url": "/shop/red_flag.png",
    "category": "color",
    "sort_order": 1,
    "pattern_id": null,
    "active": true,
    "verified": true,
    "type": null,
    "metadata": null
  },
  {
    "id": 82,
    "name": "绿色旗帜",
    "description": "生机勃勃的绿色旗帜",
    "price": 0,
    "currency": "coins",
    "item_type": "flag_color",
    "item_id": 2,
    "is_available": true,
    "created_at": "2025-09-02T08:46:14.495Z",
    "updated_at": "2026-02-01T04:06:13.618Z",
    "image_url": "/shop/green_flag.png",
    "category": "color",
    "sort_order": 2,
    "pattern_id": null,
    "active": true,
    "verified": true,
    "type": null,
    "metadata": null
  },
  {
    "id": 83,
    "name": "蓝色旗帜",
    "description": "深邃的蓝色旗帜",
    "price": 0,
    "currency": "coins",
    "item_type": "flag_color",
    "item_id": 3,
    "is_available": true,
    "created_at": "2025-09-02T08:46:14.495Z",
    "updated_at": "2026-02-01T04:06:11.362Z",
    "image_url": "/shop/blue_flag.png",
    "category": "color",
    "sort_order": 3,
    "pattern_id": null,
    "active": true,
    "verified": true,
    "type": null,
    "metadata": null
  },
  {
    "id": 84,
    "name": "黄色旗帜",
    "description": "明亮的黄色旗帜",
    "price": 0,
    "currency": "coins",
    "item_type": "flag_color",
    "item_id": 4,
    "is_available": true,
    "created_at": "2025-09-02T08:46:14.495Z",
    "updated_at": "2026-02-01T04:06:15.221Z",
    "image_url": "/shop/yellow_flag.png",
    "category": "color",
    "sort_order": 4,
    "pattern_id": null,
    "active": true,
    "verified": true,
    "type": null,
    "metadata": null
  },
  {
    "id": 85,
    "name": "橙色旗帜",
    "description": "温暖的橙色旗帜",
    "price": 0,
    "currency": "coins",
    "item_type": "flag_color",
    "item_id": 5,
    "is_available": true,
    "created_at": "2025-09-02T08:46:14.495Z",
    "updated_at": "2026-02-01T04:06:17.389Z",
    "image_url": "/shop/orange_flag.png",
    "category": "color",
    "sort_order": 5,
    "pattern_id": null,
    "active": true,
    "verified": true,
    "type": null,
    "metadata": null
  },
  {
    "id": 86,
    "name": "紫色旗帜",
    "description": "高贵的紫色旗帜",
    "price": 0,
    "currency": "coins",
    "item_type": "flag_color",
    "item_id": 6,
    "is_available": true,
    "created_at": "2025-09-02T08:46:14.495Z",
    "updated_at": "2026-02-01T04:06:29.571Z",
    "image_url": "/shop/purple_flag.png",
    "category": "color",
    "sort_order": 6,
    "pattern_id": null,
    "active": true,
    "verified": true,
    "type": null,
    "metadata": null
  },
  {
    "id": 87,
    "name": "白色旗帜",
    "description": "纯净的白色旗帜",
    "price": 0,
    "currency": "coins",
    "item_type": "flag_color",
    "item_id": 7,
    "is_available": true,
    "created_at": "2025-09-02T08:46:14.495Z",
    "updated_at": "2026-02-01T04:06:30.737Z",
    "image_url": "/shop/white_flag.png",
    "category": "color",
    "sort_order": 7,
    "pattern_id": null,
    "active": true,
    "verified": true,
    "type": null,
    "metadata": null
  },
  {
    "id": 88,
    "name": "黑色旗帜",
    "description": "神秘的黑色旗帜",
    "price": 0,
    "currency": "coins",
    "item_type": "flag_color",
    "item_id": 8,
    "is_available": true,
    "created_at": "2025-09-02T08:46:14.495Z",
    "updated_at": "2026-02-01T04:06:34.992Z",
    "image_url": "/shop/black_flag.png",
    "category": "color",
    "sort_order": 8,
    "pattern_id": null,
    "active": true,
    "verified": true,
    "type": null,
    "metadata": null
  }
];
  
  for (const batch of chunk(data, 50)) {
    await knex('shop_skus').insert(batch);
  }
};
