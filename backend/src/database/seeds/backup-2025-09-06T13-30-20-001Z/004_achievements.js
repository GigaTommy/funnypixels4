exports.seed = function(knex) {
  // 删除现有数据
  return knex('achievements').del()
    .then(function () {
      // 插入种子数据
      return knex('achievements').insert([
        // 像素绘制成就
        {
          name: '像素新手',
          description: '绘制第一个像素',
          category: 'pixel',
          points: 10,
          icon_url: '/achievements/pixel_beginner.png'
        },
        {
          name: '像素爱好者',
          description: '绘制100个像素',
          category: 'pixel',
          points: 50,
          icon_url: '/achievements/pixel_lover.png'
        },
        {
          name: '像素大师',
          description: '绘制1000个像素',
          category: 'pixel',
          points: 200,
          icon_url: '/achievements/pixel_master.png'
        },
        {
          name: '像素传奇',
          description: '绘制10000个像素',
          category: 'pixel',
          points: 1000,
          icon_url: '/achievements/pixel_legend.png'
        },
        {
          name: '连续绘制',
          description: '连续7天每天至少绘制1个像素',
          category: 'pixel',
          points: 100,
          icon_url: '/achievements/pixel_streak.png'
        },

        // 社交成就
        {
          name: '社交新手',
          description: '发送第一条聊天消息',
          category: 'social',
          points: 10,
          icon_url: '/achievements/social_beginner.png'
        },
        {
          name: '聊天达人',
          description: '发送100条聊天消息',
          category: 'social',
          points: 50,
          icon_url: '/achievements/chat_expert.png'
        },
        {
          name: '社交明星',
          description: '发送1000条聊天消息',
          category: 'social',
          points: 200,
          icon_url: '/achievements/social_star.png'
        },
        {
          name: '私信达人',
          description: '发送10条私信',
          category: 'social',
          points: 30,
          icon_url: '/achievements/pm_expert.png'
        },

        // 联盟成就
        {
          name: '联盟新手',
          description: '加入第一个联盟',
          category: 'alliance',
          points: 20,
          icon_url: '/achievements/alliance_beginner.png'
        },
        {
          name: '联盟领袖',
          description: '创建第一个联盟',
          category: 'alliance',
          points: 100,
          icon_url: '/achievements/alliance_leader.png'
        },
        {
          name: '联盟活跃分子',
          description: '在联盟中活跃7天',
          category: 'alliance',
          points: 50,
          icon_url: '/achievements/alliance_active.png'
        },

        // 商店成就
        {
          name: '购物新手',
          description: '购买第一个商品',
          category: 'shop',
          points: 10,
          icon_url: '/achievements/shop_beginner.png'
        },
        {
          name: '购物达人',
          description: '购买10个商品',
          category: 'shop',
          points: 50,
          icon_url: '/achievements/shop_expert.png'
        },
        {
          name: '土豪',
          description: '消费1000金币',
          category: 'shop',
          points: 200,
          icon_url: '/achievements/shop_rich.png'
        },

        // 特殊成就
        {
          name: '早起鸟',
          description: '在早上6-9点之间绘制像素',
          category: 'special',
          points: 30,
          icon_url: '/achievements/early_bird.png'
        },
        {
          name: '夜猫子',
          description: '在晚上10-12点之间绘制像素',
          category: 'special',
          points: 30,
          icon_url: '/achievements/night_owl.png'
        },
        {
          name: '幸运儿',
          description: '在特殊活动中获得奖励',
          category: 'special',
          points: 100,
          icon_url: '/achievements/lucky.png'
        }
      ]);
    });
};
