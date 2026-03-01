const { db } = require('../src/config/database');

/**
 * UNICODE映射表
 */
const UNICODE_MAPPINGS = {
  // 基础颜色映射
  'color_red': { unicode: '🔴', render_type: 'color' },
  'color_blue': { unicode: '🔵', render_type: 'color' },
  'color_green': { unicode: '🟢', render_type: 'color' },
  'color_yellow': { unicode: '🟡', render_type: 'color' },
  'color_orange': { unicode: '🟠', render_type: 'color' },
  'color_purple': { unicode: '🟣', render_type: 'color' },
  'color_pink': { unicode: '🩷', render_type: 'color' },
  'color_cyan': { unicode: '🔷', render_type: 'color' },
  'color_black': { unicode: '⚫', render_type: 'color' },
  'color_white': { unicode: '⚪', render_type: 'color' },
  'color_gray': { unicode: '🔘', render_type: 'color' },
  'color_brown': { unicode: '🟤', render_type: 'color' },
  'color_gold': { unicode: '🟡', render_type: 'color' },
  'color_silver': { unicode: '⚪', render_type: 'color' },
  'color_lime': { unicode: '🟢', render_type: 'color' },
  'color_magenta': { unicode: '🟣', render_type: 'color' },
  'color_maroon': { unicode: '🔴', render_type: 'color' },
  'color_navy': { unicode: '🔵', render_type: 'color' },
  'color_olive': { unicode: '🟢', render_type: 'color' },
  'color_teal': { unicode: '🔷', render_type: 'color' },
  
  // Emoji图案映射
  'emoji_crown': { unicode: '👑', render_type: 'emoji' },
  'emoji_flag': { unicode: '🏁', render_type: 'emoji' },
  'emoji_star': { unicode: '⭐', render_type: 'emoji' },
  'emoji_heart': { unicode: '❤️', render_type: 'emoji' },
  'emoji_smile': { unicode: '😊', render_type: 'emoji' },
  'emoji_fire': { unicode: '🔥', render_type: 'emoji' },
  'emoji_rocket': { unicode: '🚀', render_type: 'emoji' },
  'emoji_diamond': { unicode: '💎', render_type: 'emoji' },
  'emoji_rainbow': { unicode: '🌈', render_type: 'emoji' },
  'emoji_sun': { unicode: '☀️', render_type: 'emoji' },
  'emoji_moon': { unicode: '🌙', render_type: 'emoji' },
  'emoji_flower': { unicode: '🌸', render_type: 'emoji' },
  'emoji_tree': { unicode: '🌳', render_type: 'emoji' },
  'emoji_cat': { unicode: '🐱', render_type: 'emoji' },
  'emoji_dog': { unicode: '🐶', render_type: 'emoji' },
  'emoji_bird': { unicode: '🐦', render_type: 'emoji' },
  'emoji_fish': { unicode: '🐠', render_type: 'emoji' },
  'emoji_butterfly': { unicode: '🦋', render_type: 'emoji' },
  'emoji_bee': { unicode: '🐝', render_type: 'emoji' },
  'emoji_ladybug': { unicode: '🐞', render_type: 'emoji' },
  
  // 国旗图案映射
  'flag_china': { unicode: '🇨🇳', render_type: 'emoji' },
  'flag_usa': { unicode: '🇺🇸', render_type: 'emoji' },
  'flag_japan': { unicode: '🇯🇵', render_type: 'emoji' },
  'flag_korea': { unicode: '🇰🇷', render_type: 'emoji' },
  'flag_uk': { unicode: '🇬🇧', render_type: 'emoji' },
  'flag_france': { unicode: '🇫🇷', render_type: 'emoji' },
  'flag_germany': { unicode: '🇩🇪', render_type: 'emoji' },
  'flag_italy': { unicode: '🇮🇹', render_type: 'emoji' },
  'flag_spain': { unicode: '🇪🇸', render_type: 'emoji' },
  'flag_canada': { unicode: '🇨🇦', render_type: 'emoji' },
  'flag_australia': { unicode: '🇦🇺', render_type: 'emoji' },
  'flag_brazil': { unicode: '🇧🇷', render_type: 'emoji' },
  'flag_russia': { unicode: '🇷🇺', render_type: 'emoji' },
  'flag_india': { unicode: '🇮🇳', render_type: 'emoji' },
  'flag_ukraine': { unicode: '🇺🇦', render_type: 'emoji' },
  'flag_poland': { unicode: '🇵🇱', render_type: 'emoji' },
  'flag_netherlands': { unicode: '🇳🇱', render_type: 'emoji' },
  'flag_sweden': { unicode: '🇸🇪', render_type: 'emoji' },
  'flag_norway': { unicode: '🇳🇴', render_type: 'emoji' },
  'flag_denmark': { unicode: '🇩🇰', render_type: 'emoji' },
  'flag_finland': { unicode: '🇫🇮', render_type: 'emoji' },
  'flag_switzerland': { unicode: '🇨🇭', render_type: 'emoji' },
  'flag_austria': { unicode: '🇦🇹', render_type: 'emoji' },
  'flag_belgium': { unicode: '🇧🇪', render_type: 'emoji' },
  'flag_portugal': { unicode: '🇵🇹', render_type: 'emoji' },
  'flag_greece': { unicode: '🇬🇷', render_type: 'emoji' },
  'flag_turkey': { unicode: '🇹🇷', render_type: 'emoji' },
  'flag_iran': { unicode: '🇮🇷', render_type: 'emoji' },
  'flag_egypt': { unicode: '🇪🇬', render_type: 'emoji' },
  'flag_south_africa': { unicode: '🇿🇦', render_type: 'emoji' },
  'flag_nigeria': { unicode: '🇳🇬', render_type: 'emoji' },
  'flag_kenya': { unicode: '🇰🇪', render_type: 'emoji' },
  'flag_ethiopia': { unicode: '🇪🇹', render_type: 'emoji' },
  'flag_morocco': { unicode: '🇲🇦', render_type: 'emoji' },
  'flag_algeria': { unicode: '🇩🇿', render_type: 'emoji' },
  'flag_tunisia': { unicode: '🇹🇳', render_type: 'emoji' },
  'flag_libya': { unicode: '🇱🇾', render_type: 'emoji' },
  'flag_sudan': { unicode: '🇸🇩', render_type: 'emoji' },
  'flag_chad': { unicode: '🇹🇩', render_type: 'emoji' },
  'flag_niger': { unicode: '🇳🇪', render_type: 'emoji' },
  'flag_mali': { unicode: '🇲🇱', render_type: 'emoji' },
  'flag_burkina_faso': { unicode: '🇧🇫', render_type: 'emoji' },
  'flag_senegal': { unicode: '🇸🇳', render_type: 'emoji' },
  'flag_guinea': { unicode: '🇬🇳', render_type: 'emoji' },
  'flag_ivory_coast': { unicode: '🇨🇮', render_type: 'emoji' },
  'flag_ghana': { unicode: '🇬🇭', render_type: 'emoji' },
  'flag_togo': { unicode: '🇹🇬', render_type: 'emoji' },
  'flag_benin': { unicode: '🇧🇯', render_type: 'emoji' },
  'flag_cameroon': { unicode: '🇨🇲', render_type: 'emoji' },
  'flag_central_african_republic': { unicode: '🇨🇫', render_type: 'emoji' },
  'flag_equatorial_guinea': { unicode: '🇬🇶', render_type: 'emoji' },
  'flag_gabon': { unicode: '🇬🇦', render_type: 'emoji' },
  'flag_congo': { unicode: '🇨🇬', render_type: 'emoji' },
  'flag_democratic_republic_congo': { unicode: '🇨🇩', render_type: 'emoji' },
  'flag_angola': { unicode: '🇦🇴', render_type: 'emoji' },
  'flag_zambia': { unicode: '🇿🇲', render_type: 'emoji' },
  'flag_zimbabwe': { unicode: '🇿🇼', render_type: 'emoji' },
  'flag_botswana': { unicode: '🇧🇼', render_type: 'emoji' },
  'flag_namibia': { unicode: '🇳🇦', render_type: 'emoji' },
  'flag_lesotho': { unicode: '🇱🇸', render_type: 'emoji' },
  'flag_eswatini': { unicode: '🇸🇿', render_type: 'emoji' },
  'flag_madagascar': { unicode: '🇲🇬', render_type: 'emoji' },
  'flag_mauritius': { unicode: '🇲🇺', render_type: 'emoji' },
  'flag_seychelles': { unicode: '🇸🇨', render_type: 'emoji' },
  'flag_comoros': { unicode: '🇰🇲', render_type: 'emoji' },
  'flag_djibouti': { unicode: '🇩🇯', render_type: 'emoji' },
  'flag_somalia': { unicode: '🇸🇴', render_type: 'emoji' },
  'flag_eritrea': { unicode: '🇪🇷', render_type: 'emoji' },
  'flag_burundi': { unicode: '🇧🇮', render_type: 'emoji' },
  'flag_rwanda': { unicode: '🇷🇼', render_type: 'emoji' },
  'flag_uganda': { unicode: '🇺🇬', render_type: 'emoji' },
  'flag_tanzania': { unicode: '🇹🇿', render_type: 'emoji' },
  'flag_mozambique': { unicode: '🇲🇿', render_type: 'emoji' },
  'flag_malawi': { unicode: '🇲🇼', render_type: 'emoji' },
  'flag_zambia': { unicode: '🇿🇲', render_type: 'emoji' },
  'flag_zimbabwe': { unicode: '🇿🇼', render_type: 'emoji' },
  'flag_botswana': { unicode: '🇧🇼', render_type: 'emoji' },
  'flag_namibia': { unicode: '🇳🇦', render_type: 'emoji' },
  'flag_lesotho': { unicode: '🇱🇸', render_type: 'emoji' },
  'flag_eswatini': { unicode: '🇸🇿', render_type: 'emoji' },
  'flag_madagascar': { unicode: '🇲🇬', render_type: 'emoji' },
  'flag_mauritius': { unicode: '🇲🇺', render_type: 'emoji' },
  'flag_seychelles': { unicode: '🇸🇨', render_type: 'emoji' },
  'flag_comoros': { unicode: '🇰🇲', render_type: 'emoji' },
  'flag_djibouti': { unicode: '🇩🇯', render_type: 'emoji' },
  'flag_somalia': { unicode: '🇸🇴', render_type: 'emoji' },
  'flag_eritrea': { unicode: '🇪🇷', render_type: 'emoji' },
  'flag_burundi': { unicode: '🇧🇮', render_type: 'emoji' },
  'flag_rwanda': { unicode: '🇷🇼', render_type: 'emoji' },
  'flag_uganda': { unicode: '🇺🇬', render_type: 'emoji' },
  'flag_tanzania': { unicode: '🇹🇿', render_type: 'emoji' },
  'flag_mozambique': { unicode: '🇲🇿', render_type: 'emoji' },
  'flag_malawi': { unicode: '🇲🇼', render_type: 'emoji' }
};

/**
 * 更新图案的UNICODE编码
 */
async function updatePatternUnicode() {
  try {
    console.log('🔧 开始更新图案UNICODE编码...');
    
    // 获取所有图案
    const patterns = await db('pattern_assets').select('*');
    console.log(`📊 找到 ${patterns.length} 个图案`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const pattern of patterns) {
      const mapping = UNICODE_MAPPINGS[pattern.key];
      
      if (mapping) {
        // 更新图案
        await db('pattern_assets')
          .where('id', pattern.id)
          .update({
            unicode_char: mapping.unicode,
            render_type: mapping.render_type,
            updated_at: db.fn.now()
          });
        
        console.log(`✅ 更新图案: ${pattern.key} -> ${mapping.unicode} (${mapping.render_type})`);
        updatedCount++;
      } else {
        // 对于没有映射的图案，设置为复杂类型
        await db('pattern_assets')
          .where('id', pattern.id)
          .update({
            render_type: 'complex',
            updated_at: db.fn.now()
          });
        
        console.log(`⚠️ 跳过图案: ${pattern.key} (设置为complex类型)`);
        skippedCount++;
      }
    }
    
    console.log(`🎉 更新完成！`);
    console.log(`✅ 更新了 ${updatedCount} 个图案`);
    console.log(`⚠️ 跳过了 ${skippedCount} 个图案`);
    
  } catch (error) {
    console.error('❌ 更新图案UNICODE编码失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updatePatternUnicode()
    .then(() => {
      console.log('✅ 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = updatePatternUnicode;
