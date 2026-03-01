exports.seed = function(knex) {
  return knex('shop_skus').del()
    .then(function () {
      return knex('shop_skus').insert([
        // 免费颜色旗帜
        {
          name: '红色旗帜',
          description: '经典红色旗帜',
          price: 0,
          currency: 'coins',
          item_type: 'flag_color',
          item_id: 1,
          is_available: true,
          image_url: '/shop/red_flag.png',
          category: 'color',
          sort_order: 1
        },
        {
          name: '绿色旗帜',
          description: '生机勃勃的绿色旗帜',
          price: 0,
          currency: 'coins',
          item_type: 'flag_color',
          item_id: 2,
          is_available: true,
          image_url: '/shop/green_flag.png',
          category: 'color',
          sort_order: 2
        },
        {
          name: '蓝色旗帜',
          description: '深邃的蓝色旗帜',
          price: 0,
          currency: 'coins',
          item_type: 'flag_color',
          item_id: 3,
          is_available: true,
          image_url: '/shop/blue_flag.png',
          category: 'color',
          sort_order: 3
        },
        {
          name: '黄色旗帜',
          description: '明亮的黄色旗帜',
          price: 0,
          currency: 'coins',
          item_type: 'flag_color',
          item_id: 4,
          is_available: true,
          image_url: '/shop/yellow_flag.png',
          category: 'color',
          sort_order: 4
        },
        {
          name: '橙色旗帜',
          description: '温暖的橙色旗帜',
          price: 0,
          currency: 'coins',
          item_type: 'flag_color',
          item_id: 5,
          is_available: true,
          image_url: '/shop/orange_flag.png',
          category: 'color',
          sort_order: 5
        },
        {
          name: '紫色旗帜',
          description: '高贵的紫色旗帜',
          price: 0,
          currency: 'coins',
          item_type: 'flag_color',
          item_id: 6,
          is_available: true,
          image_url: '/shop/purple_flag.png',
          category: 'color',
          sort_order: 6
        },
        {
          name: '白色旗帜',
          description: '纯净的白色旗帜',
          price: 0,
          currency: 'coins',
          item_type: 'flag_color',
          item_id: 7,
          is_available: true,
          image_url: '/shop/white_flag.png',
          category: 'color',
          sort_order: 7
        },
        {
          name: '黑色旗帜',
          description: '神秘的黑色旗帜',
          price: 0,
          currency: 'coins',
          item_type: 'flag_color',
          item_id: 8,
          is_available: true,
          image_url: '/shop/black_flag.png',
          category: 'color',
          sort_order: 8
        },

        // 付费emoji图案旗帜 (50金币)
        {
          name: '红色emoji旗帜',
          description: '可爱的红色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 101,
          is_available: true,
          image_url: '/shop/emoji_red_flag.png',
          category: 'emoji',
          sort_order: 101
        },
        {
          name: '蓝色emoji旗帜',
          description: '可爱的蓝色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 102,
          is_available: true,
          image_url: '/shop/emoji_blue_flag.png',
          category: 'emoji',
          sort_order: 102
        },
        {
          name: '绿色emoji旗帜',
          description: '可爱的绿色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 103,
          is_available: true,
          image_url: '/shop/emoji_green_flag.png',
          category: 'emoji',
          sort_order: 103
        },
        {
          name: '黄色emoji旗帜',
          description: '可爱的黄色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 104,
          is_available: true,
          image_url: '/shop/emoji_yellow_flag.png',
          category: 'emoji',
          sort_order: 104
        },
        {
          name: '橙色emoji旗帜',
          description: '可爱的橙色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 105,
          is_available: true,
          image_url: '/shop/emoji_orange_flag.png',
          category: 'emoji',
          sort_order: 105
        },
        {
          name: '紫色emoji旗帜',
          description: '可爱的紫色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 106,
          is_available: true,
          image_url: '/shop/emoji_purple_flag.png',
          category: 'emoji',
          sort_order: 106
        },
        {
          name: '粉色emoji旗帜',
          description: '可爱的粉色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 107,
          is_available: true,
          image_url: '/shop/emoji_pink_flag.png',
          category: 'emoji',
          sort_order: 107
        },
        {
          name: '青色emoji旗帜',
          description: '可爱的青色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 108,
          is_available: true,
          image_url: '/shop/emoji_cyan_flag.png',
          category: 'emoji',
          sort_order: 108
        },
        {
          name: '白色emoji旗帜',
          description: '可爱的白色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 109,
          is_available: true,
          image_url: '/shop/emoji_white_flag.png',
          category: 'emoji',
          sort_order: 109
        },
        {
          name: '黑色emoji旗帜',
          description: '可爱的黑色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 110,
          is_available: true,
          image_url: '/shop/emoji_black_flag.png',
          category: 'emoji',
          sort_order: 110
        },
        {
          name: '金色emoji旗帜',
          description: '可爱的金色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 111,
          is_available: true,
          image_url: '/shop/emoji_gold_flag.png',
          category: 'emoji',
          sort_order: 111
        },
        {
          name: '银色emoji旗帜',
          description: '可爱的银色emoji旗帜',
          price: 50,
          currency: 'coins',
          item_type: 'flag_pattern',
          item_id: 112,
          is_available: true,
          image_url: '/shop/emoji_silver_flag.png',
          category: 'emoji',
          sort_order: 112
        }
      ]);
    });
};
