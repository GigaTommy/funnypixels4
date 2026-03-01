const fs = require('fs');
const path = require('path');

/**
 * 重命名迁移文件，确保命名规范化和顺序可控
 * 格式：YYYYMMDD_XXX_description.js
 */

// 迁移文件重命名映射表
const migrationRenames = [
  // 基础表结构
  { old: '20250827051811_create_all_tables.js', new: '20250827_001_create_all_tables.js' },
  { old: '20250827051818_convert_to_uuid.js', new: '20250827_002_convert_to_uuid.js' },
  { old: '20250827051820_create_alliance_applications.js', new: '20250827_003_create_alliance_applications.js' },
  { old: '20250827051821_create_user_inventory.js', new: '20250827_004_create_user_inventory.js' },
  { old: '20250827051822_create_advertisements.js', new: '20250827_005_create_advertisements.js' },
  { old: '20250827051823_create_user_ad_credits.js', new: '20250827_006_create_user_ad_credits.js' },
  { old: '20250827051824_create_user_points_table.js', new: '20250827_007_create_user_points_table.js' },
  { old: '20250827051825_create_user_shares_table.js', new: '20250827_008_create_user_shares_table.js' },
  { old: '20250827051828_add_store_payment_system.js', new: '20250827_009_add_store_payment_system.js' },
  { old: '20250827051829_update_store_items_prices.js', new: '20250827_010_update_store_items_prices.js' },
  { old: '20250827051830_add_alliance_is_active.js', new: '20250827_011_add_alliance_is_active.js' },
  { old: '20250827051831_add_alliance_pattern_fields.js', new: '20250827_012_add_alliance_pattern_fields.js' },
  { old: '20250827051832_add_pattern_fields.js', new: '20250827_013_add_pattern_fields.js' },
  { old: '20250827051833_add_shop_skus_pattern_id.js', new: '20250827_014_add_shop_skus_pattern_id.js' },
  { old: '20250827051835_add_pixel_points_separation.js', new: '20250827_015_add_pixel_points_separation.js' },
  { old: '20250827051836_fix_chat_messages_structure.js', new: '20250827_016_fix_chat_messages_structure.js' },
  
  // 8月29日
  { old: '20250829_add_unicode_to_alliances.js', new: '20250829_001_add_unicode_to_alliances.js' },
  { old: '20250829_add_unicode_to_pattern_assets.js', new: '20250829_002_add_unicode_to_pattern_assets.js' },
  { old: '20250829021958_fix_pattern_assets_table.js', new: '20250829_003_fix_pattern_assets_table.js' },
  { old: '20250829023626_add_deleted_at_to_pattern_assets.js', new: '20250829_004_add_deleted_at_to_pattern_assets.js' },
  
  // 9月4日
  { old: '20250904_add_flag_payload_to_alliances.js', new: '20250904_001_add_flag_payload_to_alliances.js' },
  
  // 9月5日
  { old: '20250905_add_color_to_pattern_assets.js', new: '20250905_001_add_color_to_pattern_assets.js' },
  
  // 9月6日
  { old: '20250906_add_grid_id_unique_constraint.js', new: '20250906_001_add_grid_id_unique_constraint.js' },
  
  // 9月7日
  { old: '20250907_add_missing_natural_accumulation_fields.js', new: '20250907_001_add_missing_natural_accumulation_fields.js' },
  { old: '20250907_create_pixels_history_partitioned.js', new: '20250907_002_create_pixels_history_partitioned.js' },
  { old: '20250907_fix_user_inventory_foreign_key.js', new: '20250907_003_fix_user_inventory_foreign_key.js' },
  
  // 9月8日
  { old: '20250908_add_avatar_field_to_users.js', new: '20250908_001_add_avatar_field_to_users.js' },
  
  // 9月9日
  { old: '20250909_create_ad_system_tables.js', new: '20250909_001_create_ad_system_tables.js' },
  { old: '20250909_create_custom_flag_tables.js', new: '20250909_002_create_custom_flag_tables.js' },
  
  // 9月11日
  { old: '20250911_add_ad_pixel_fields.js', new: '20250911_001_add_ad_pixel_fields.js' },
  { old: '20250911_add_avatar_field_to_users.js', new: '20250911_002_add_avatar_field_to_users.js' },
  { old: '20250911_add_pixel_type_to_history.js', new: '20250911_003_add_pixel_type_to_history.js' },
  { old: '20250911_add_size_fields_to_ad_products.js', new: '20250911_004_add_size_fields_to_ad_products.js' },
  { old: '20250911_create_leaderboard_tables.js', new: '20250911_005_create_leaderboard_tables.js' },
  { old: '20250911_fix_leaderboard_field_lengths.js', new: '20250911_006_fix_leaderboard_field_lengths.js' },
  { old: '20250911_fix_leaderboard_table_types.js', new: '20250911_007_fix_leaderboard_table_types.js' },
  { old: '20250911_fix_table_compatibility.js', new: '20250911_008_fix_table_compatibility.js' },
  { old: '20250911093913_add_avatar_to_leaderboard_personal.js', new: '20250911_009_add_avatar_to_leaderboard_personal.js' },
  
  // 9月12日
  { old: '20250912_001_ensure_16_color_palette.js', new: '20250912_001_ensure_16_color_palette.js' }, // 已经是正确格式
  { old: '20250112_create_temp_pattern_storage.js', new: '20250912_002_create_temp_pattern_storage.js' }, // 修正日期
];

/**
 * 重命名迁移文件
 */
async function renameMigrations() {
  try {
    console.log('🔄 开始重命名迁移文件...');
    
    const migrationsDir = path.join(__dirname, '../src/database/migrations');
    
    // 检查目录是否存在
    if (!fs.existsSync(migrationsDir)) {
      console.error('❌ 迁移目录不存在:', migrationsDir);
      return;
    }
    
    let renamedCount = 0;
    let skippedCount = 0;
    
    for (const rename of migrationRenames) {
      const oldPath = path.join(migrationsDir, rename.old);
      const newPath = path.join(migrationsDir, rename.new);
      
      if (fs.existsSync(oldPath)) {
        if (fs.existsSync(newPath)) {
          console.log(`⚠️  目标文件已存在，跳过: ${rename.old} -> ${rename.new}`);
          skippedCount++;
        } else {
          fs.renameSync(oldPath, newPath);
          console.log(`✅ 重命名成功: ${rename.old} -> ${rename.new}`);
          renamedCount++;
        }
      } else {
        console.log(`⚠️  源文件不存在: ${rename.old}`);
        skippedCount++;
      }
    }
    
    console.log(`\n📊 重命名统计:`);
    console.log(`   成功重命名: ${renamedCount} 个文件`);
    console.log(`   跳过: ${skippedCount} 个文件`);
    
    // 列出重命名后的文件
    console.log(`\n📋 重命名后的迁移文件列表:`);
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();
    
    files.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });
    
    console.log(`\n🎉 迁移文件重命名完成！`);
    
  } catch (error) {
    console.error('❌ 重命名失败:', error);
  }
}

// 运行重命名
if (require.main === module) {
  renameMigrations();
}

module.exports = { renameMigrations };
