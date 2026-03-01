exports.seed = function(knex) {
  return knex('pattern_assets').del()
    .then(function () {
      return knex('pattern_assets').insert([
        // ===== 基础颜色图案 =====
        {
          key: 'color_red',
          name: '红色',
          description: '基础红色',
          image_url: '/patterns/color_red.png',
          category: 'color',
          tags: ['红色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FF0000' }
          ]),
          verified: true,
          unicode_char: '🔴',
          render_type: 'color',
          color: '#FF0000'
        },
        {
          key: 'color_blue',
          name: '蓝色',
          description: '基础蓝色',
          image_url: '/patterns/color_blue.png',
          category: 'color',
          tags: ['蓝色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#0000FF' }
          ]),
          verified: true,
          unicode_char: '🔵',
          render_type: 'color',
          color: '#0000FF'
        },
        {
          key: 'color_green',
          name: '绿色',
          description: '基础绿色',
          image_url: '/patterns/color_green.png',
          category: 'color',
          tags: ['绿色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#00FF00' }
          ]),
          verified: true,
          unicode_char: '🟢',
          render_type: 'color',
          color: '#00FF00'
        },
        {
          key: 'color_yellow',
          name: '黄色',
          description: '基础黄色',
          image_url: '/patterns/color_yellow.png',
          category: 'color',
          tags: ['黄色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFFF00' }
          ]),
          verified: true,
          unicode_char: '🟡',
          render_type: 'color',
          color: '#FFFF00'
        },
        {
          key: 'color_orange',
          name: '橙色',
          description: '基础橙色',
          image_url: '/patterns/color_orange.png',
          category: 'color',
          tags: ['橙色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFA500' }
          ]),
          verified: true,
          unicode_char: '🟠',
          render_type: 'color',
          color: '#FFA500'
        },
        {
          key: 'color_purple',
          name: '紫色',
          description: '基础紫色',
          image_url: '/patterns/color_purple.png',
          category: 'color',
          tags: ['紫色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#800080' }
          ]),
          verified: true,
          unicode_char: '🟣',
          render_type: 'color',
          color: '#800080'
        },
        {
          key: 'color_pink',
          name: '粉色',
          description: '基础粉色',
          image_url: '/patterns/color_pink.png',
          category: 'color',
          tags: ['粉色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFC0CB' }
          ]),
          verified: true,
          unicode_char: '🌸',
          render_type: 'color',
          color: '#FFC0CB'
        },
        {
          key: 'color_cyan',
          name: '青色',
          description: '基础青色',
          image_url: '/patterns/color_cyan.png',
          category: 'color',
          tags: ['青色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#00FFFF' }
          ]),
          verified: true,
          unicode_char: '💎',
          render_type: 'color',
          color: '#00FFFF'
        },
        {
          key: 'color_white',
          name: '白色',
          description: '基础白色',
          image_url: '/patterns/color_white.png',
          category: 'color',
          tags: ['白色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFFFFF' }
          ]),
          verified: true,
          unicode_char: '⚪',
          render_type: 'color',
          color: '#FFFFFF'
        },
        {
          key: 'color_black',
          name: '黑色',
          description: '基础黑色',
          image_url: '/patterns/color_black.png',
          category: 'color',
          tags: ['黑色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#000000' }
          ]),
          verified: true,
          unicode_char: '⚫',
          render_type: 'color',
          color: '#000000'
        },
        {
          key: 'color_gray',
          name: '灰色',
          description: '基础灰色',
          image_url: '/patterns/color_gray.png',
          category: 'color',
          tags: ['灰色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#808080' }
          ]),
          verified: true,
          unicode_char: '🔘',
          render_type: 'color',
          color: '#808080'
        },
        {
          key: 'color_gold',
          name: '金色',
          description: '基础金色',
          image_url: '/patterns/color_gold.png',
          category: 'color',
          tags: ['金色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFD700' }
          ]),
          verified: true,
          unicode_char: '⭐',
          render_type: 'color',
          color: '#FFD700'
        },
        {
          key: 'color_silver',
          name: '银色',
          description: '基础银色',
          image_url: '/patterns/color_silver.png',
          category: 'color',
          tags: ['银色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#C0C0C0' }
          ]),
          verified: true,
          unicode_char: '💿',
          render_type: 'color',
          color: '#C0C0C0'
        },
        {
          key: 'color_magenta',
          name: '洋红',
          description: '基础洋红色',
          image_url: '/patterns/color_magenta.png',
          category: 'color',
          tags: ['洋红', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FF00FF' }
          ]),
          verified: true,
          unicode_char: '🌺',
          render_type: 'color',
          color: '#FF00FF'
        },
        {
          key: 'color_lime',
          name: '青柠',
          description: '基础青柠色',
          image_url: '/patterns/color_lime.png',
          category: 'color',
          tags: ['青柠', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#00FF00' }
          ]),
          verified: true,
          unicode_char: '🍃',
          render_type: 'color',
          color: '#00FF00'
        },
        {
          key: 'color_navy',
          name: '海军蓝',
          description: '基础海军蓝色',
          image_url: '/patterns/color_navy.png',
          category: 'color',
          tags: ['海军蓝', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#000080' }
          ]),
          verified: true,
          unicode_char: '🌊',
          render_type: 'color',
          color: '#000080'
        },
        {
          key: 'color_teal',
          name: '蓝绿',
          description: '基础蓝绿色',
          image_url: '/patterns/color_teal.png',
          category: 'color',
          tags: ['蓝绿', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#008080' }
          ]),
          verified: true,
          unicode_char: '🐢',
          render_type: 'color',
          color: '#008080'
        },
        {
          key: 'color_olive',
          name: '橄榄绿',
          description: '基础橄榄绿色',
          image_url: '/patterns/color_olive.png',
          category: 'color',
          tags: ['橄榄绿', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#808000' }
          ]),
          verified: true,
          unicode_char: '🫒',
          render_type: 'color',
          color: '#808000'
        },
        {
          key: 'color_maroon',
          name: '栗色',
          description: '基础栗色',
          image_url: '/patterns/color_maroon.png',
          category: 'color',
          tags: ['栗色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#800000' }
          ]),
          verified: true,
          unicode_char: '🍷',
          render_type: 'color',
          color: '#800000'
        },
        {
          key: 'color_brown',
          name: '棕色',
          description: '基础棕色',
          image_url: '/patterns/color_brown.png',
          category: 'color',
          tags: ['棕色', '基础', '颜色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#A52A2A' }
          ]),
          verified: true,
          unicode_char: '🍫',
          render_type: 'color',
          color: '#A52A2A'
        },
        
        // ===== 常见Emoji图案 =====
        {
          key: 'emoji_crown',
          name: '皇冠',
          description: '金色皇冠emoji',
          image_url: '/patterns/emoji_crown.png',
          category: 'emoji',
          tags: ['皇冠', 'emoji', '装饰', '金色'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFD700' }
          ]),
          verified: true,
          unicode_char: '👑',
          render_type: 'emoji',
          color: '#FFD700'
        },
        {
          key: 'emoji_star',
          name: '星星',
          description: '闪亮星星emoji',
          image_url: '/patterns/emoji_star.png',
          category: 'emoji',
          tags: ['星星', 'emoji', '闪亮', '装饰'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFD700' }
          ]),
          verified: true,
          unicode_char: '⭐',
          render_type: 'emoji',
          color: '#FFD700'
        },
        {
          key: 'emoji_heart',
          name: '爱心',
          description: '红色爱心emoji',
          image_url: '/patterns/emoji_heart.png',
          category: 'emoji',
          tags: ['爱心', 'emoji', '红色', '情感'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FF0000' }
          ]),
          verified: true,
          unicode_char: '❤️',
          render_type: 'emoji',
          color: '#FF0000'
        },
        {
          key: 'emoji_fire',
          name: '火焰',
          description: '橙色火焰emoji',
          image_url: '/patterns/emoji_fire.png',
          category: 'emoji',
          tags: ['火焰', 'emoji', '橙色', '能量'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFA500' }
          ]),
          verified: true,
          unicode_char: '🔥',
          render_type: 'emoji',
          color: '#FFA500'
        },
        {
          key: 'emoji_water',
          name: '水滴',
          description: '蓝色水滴emoji',
          image_url: '/patterns/emoji_water.png',
          category: 'emoji',
          tags: ['水滴', 'emoji', '蓝色', '水'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#00BFFF' }
          ]),
          verified: true,
          unicode_char: '💧',
          render_type: 'emoji',
          color: '#00BFFF'
        },
        {
          key: 'emoji_leaf',
          name: '叶子',
          description: '绿色叶子emoji',
          image_url: '/patterns/emoji_leaf.png',
          category: 'emoji',
          tags: ['叶子', 'emoji', '绿色', '自然'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#228B22' }
          ]),
          verified: true,
          unicode_char: '🍃',
          render_type: 'emoji',
          color: '#228B22'
        },
        {
          key: 'emoji_sun',
          name: '太阳',
          description: '黄色太阳emoji',
          image_url: '/patterns/emoji_sun.png',
          category: 'emoji',
          tags: ['太阳', 'emoji', '黄色', '光明'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFD700' }
          ]),
          verified: true,
          unicode_char: '☀️',
          render_type: 'emoji',
          color: '#FFD700'
        },
        {
          key: 'emoji_moon',
          name: '月亮',
          description: '银色月亮emoji',
          image_url: '/patterns/emoji_moon.png',
          category: 'emoji',
          tags: ['月亮', 'emoji', '银色', '夜晚'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#C0C0C0' }
          ]),
          verified: true,
          unicode_char: '🌙',
          render_type: 'emoji',
          color: '#C0C0C0'
        },
        {
          key: 'emoji_cloud',
          name: '云朵',
          description: '白色云朵emoji',
          image_url: '/patterns/emoji_cloud.png',
          category: 'emoji',
          tags: ['云朵', 'emoji', '白色', '天空'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFFFFF' }
          ]),
          verified: true,
          unicode_char: '☁️',
          render_type: 'emoji',
          color: '#FFFFFF'
        },
        {
          key: 'emoji_rainbow',
          name: '彩虹',
          description: '彩色彩虹emoji',
          image_url: '/patterns/emoji_rainbow.png',
          category: 'emoji',
          tags: ['彩虹', 'emoji', '彩色', '美丽'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FF69B4' }
          ]),
          verified: true,
          unicode_char: '🌈',
          render_type: 'emoji',
          color: '#FF69B4'
        },
        {
          key: 'emoji_flower',
          name: '花朵',
          description: '粉色花朵emoji',
          image_url: '/patterns/emoji_flower.png',
          category: 'emoji',
          tags: ['花朵', 'emoji', '粉色', '美丽'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFC0CB' }
          ]),
          verified: true,
          unicode_char: '🌸',
          render_type: 'emoji',
          color: '#FFC0CB'
        },
        {
          key: 'emoji_tree',
          name: '树木',
          description: '绿色树木emoji',
          image_url: '/patterns/emoji_tree.png',
          category: 'emoji',
          tags: ['树木', 'emoji', '绿色', '自然'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#228B22' }
          ]),
          verified: true,
          unicode_char: '🌳',
          render_type: 'emoji',
          color: '#228B22'
        },
        {
          key: 'emoji_rock',
          name: '岩石',
          description: '灰色岩石emoji',
          image_url: '/patterns/emoji_rock.png',
          category: 'emoji',
          tags: ['岩石', 'emoji', '灰色', '坚固'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#808080' }
          ]),
          verified: true,
          unicode_char: '🪨',
          render_type: 'emoji',
          color: '#808080'
        },
        {
          key: 'emoji_lightning',
          name: '闪电',
          description: '黄色闪电emoji',
          image_url: '/patterns/emoji_lightning.png',
          category: 'emoji',
          tags: ['闪电', 'emoji', '黄色', '能量'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFD700' }
          ]),
          verified: true,
          unicode_char: '⚡',
          render_type: 'emoji',
          color: '#FFD700'
        },
        {
          key: 'emoji_snowflake',
          name: '雪花',
          description: '白色雪花emoji',
          image_url: '/patterns/emoji_snowflake.png',
          category: 'emoji',
          tags: ['雪花', 'emoji', '白色', '冬天'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFFFFF' }
          ]),
          verified: true,
          unicode_char: '❄️',
          render_type: 'emoji',
          color: '#FFFFFF'
        },
        {
          key: 'emoji_umbrella',
          name: '雨伞',
          description: '蓝色雨伞emoji',
          image_url: '/patterns/emoji_umbrella.png',
          category: 'emoji',
          tags: ['雨伞', 'emoji', '蓝色', '雨天'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#4169E1' }
          ]),
          verified: true,
          unicode_char: '☔',
          render_type: 'emoji',
          color: '#4169E1'
        },
        {
          key: 'emoji_anchor',
          name: '船锚',
          description: '银色船锚emoji',
          image_url: '/patterns/emoji_anchor.png',
          category: 'emoji',
          tags: ['船锚', 'emoji', '银色', '海洋'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#C0C0C0' }
          ]),
          verified: true,
          unicode_char: '⚓',
          render_type: 'emoji',
          color: '#C0C0C0'
        },
        {
          key: 'emoji_compass',
          name: '指南针',
          description: '金色指南针emoji',
          image_url: '/patterns/emoji_compass.png',
          category: 'emoji',
          tags: ['指南针', 'emoji', '金色', '方向'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#FFD700' }
          ]),
          verified: true,
          unicode_char: '🧭',
          render_type: 'emoji',
          color: '#FFD700'
        },
        {
          key: 'emoji_globe',
          name: '地球',
          description: '蓝色地球emoji',
          image_url: '/patterns/emoji_globe.png',
          category: 'emoji',
          tags: ['地球', 'emoji', '蓝色', '世界'],
          is_public: true,
          created_by: null,
          width: 32,
          height: 32,
          encoding: 'rle',
          payload: JSON.stringify([
            { count: 1024, color: '#4169E1' }
          ]),
          verified: true,
          unicode_char: '🌍',
          render_type: 'emoji',
          color: '#4169E1'
        }
      ]);
    });
};
