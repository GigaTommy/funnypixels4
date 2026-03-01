# 迁移文件命名规范

## 概述

为了确保迁移文件的顺序可控和命名规范化，我们采用统一的命名格式。

## 命名格式

```
YYYYMMDD_XXX_description.js
```

### 格式说明

- **YYYYMMDD**: 8位日期，格式为年-月-日
  - 例如：`20250827` 表示 2025年8月27日
- **XXX**: 3位序号，从001开始递增
  - 同一天内的多个迁移文件使用递增序号
  - 例如：`001`, `002`, `003`
- **description**: 迁移描述，使用下划线分隔的小写字母
  - 描述应该简洁明了，说明迁移的目的
  - 例如：`create_all_tables`, `add_user_avatar_field`

## 示例

### 正确的命名示例

```
20250827_001_create_all_tables.js
20250827_002_convert_to_uuid.js
20250827_003_create_alliance_applications.js
20250829_001_add_unicode_to_alliances.js
20250829_002_add_unicode_to_pattern_assets.js
20250912_001_ensure_16_color_palette.js
20250912_002_create_temp_pattern_storage.js
```

### 错误的命名示例

```
❌ 20250827051811_create_all_tables.js  # 时间戳过长
❌ 20250829_add_unicode_to_alliances.js  # 缺少序号
❌ create_all_tables.js                  # 缺少日期和序号
❌ 20250827_create_all_tables.js         # 缺少序号
```

## 命名规则

### 1. 日期规则
- 使用迁移创建的实际日期
- 格式必须为 `YYYYMMDD`
- 不能使用时间戳或其他格式

### 2. 序号规则
- 同一天内的迁移文件必须使用递增序号
- 序号从 `001` 开始
- 序号必须是3位数字，不足3位前面补0
- 不能跳过序号

### 3. 描述规则
- 使用小写字母和下划线
- 描述应该简洁明了
- 避免使用特殊字符和空格
- 建议使用动词开头，如 `create_`, `add_`, `update_`, `fix_`

## 创建新迁移文件

### 1. 确定日期
使用当前日期作为迁移文件的日期部分。

### 2. 确定序号
检查同一天是否已有迁移文件，使用下一个可用序号。

### 3. 编写描述
根据迁移内容编写简洁的描述。

### 4. 示例命令

```bash
# 创建新的迁移文件
npx knex migrate:make 20250912_003_add_new_feature

# 这将创建文件：20250912_003_add_new_feature.js
```

## 迁移文件重命名

如果需要重命名现有的迁移文件，请遵循以下步骤：

### 1. 重命名文件
将文件重命名为新的规范格式。

### 2. 更新数据库记录
运行修复脚本更新数据库中的迁移记录：

```bash
node scripts/fix-migration-records.js
```

### 3. 验证迁移状态
检查迁移状态确保一切正常：

```bash
npx knex migrate:status
```

## 工具脚本

### 重命名迁移文件
```bash
node scripts/rename-migrations.js
```

### 修复迁移记录
```bash
node scripts/fix-migration-records.js
```

## 注意事项

1. **不要手动修改迁移文件内容**：迁移文件一旦执行，其内容不应该被修改
2. **保持序号连续性**：同一天内的迁移文件序号必须连续
3. **使用描述性名称**：迁移文件名应该清楚地说明其目的
4. **遵循命名规范**：严格按照 `YYYYMMDD_XXX_description.js` 格式命名

## 迁移文件列表

当前项目中的迁移文件（按时间顺序）：

```
20250827_001_create_all_tables.js
20250827_002_convert_to_uuid.js
20250827_003_create_alliance_applications.js
20250827_004_create_user_inventory.js
20250827_005_create_advertisements.js
20250827_006_create_user_ad_credits.js
20250827_007_create_user_points_table.js
20250827_008_create_user_shares_table.js
20250827_009_add_store_payment_system.js
20250827_010_update_store_items_prices.js
20250827_011_add_alliance_is_active.js
20250827_012_add_alliance_pattern_fields.js
20250827_013_add_pattern_fields.js
20250827_014_add_shop_skus_pattern_id.js
20250827_015_add_pixel_points_separation.js
20250827_016_fix_chat_messages_structure.js
20250829_001_add_unicode_to_alliances.js
20250829_002_add_unicode_to_pattern_assets.js
20250829_003_fix_pattern_assets_table.js
20250829_004_add_deleted_at_to_pattern_assets.js
20250904_001_add_flag_payload_to_alliances.js
20250905_001_add_color_to_pattern_assets.js
20250906_001_add_grid_id_unique_constraint.js
20250907_001_add_missing_natural_accumulation_fields.js
20250907_002_create_pixels_history_partitioned.js
20250907_003_fix_user_inventory_foreign_key.js
20250908_001_add_avatar_field_to_users.js
20250909_001_create_ad_system_tables.js
20250909_002_create_custom_flag_tables.js
20250911_001_add_ad_pixel_fields.js
20250911_002_add_avatar_field_to_users.js
20250911_003_add_pixel_type_to_history.js
20250911_004_add_size_fields_to_ad_products.js
20250911_005_create_leaderboard_tables.js
20250911_006_fix_leaderboard_field_lengths.js
20250911_007_fix_leaderboard_table_types.js
20250911_008_fix_table_compatibility.js
20250911_009_add_avatar_to_leaderboard_personal.js
20250912_001_ensure_16_color_palette.js
20250912_002_create_temp_pattern_storage.js
```

## 总结

通过统一的命名规范，我们确保了：

1. **顺序可控**：通过日期和序号确保迁移文件的执行顺序
2. **命名规范**：所有迁移文件都遵循相同的命名格式
3. **易于管理**：清晰的命名使得迁移文件的目的一目了然
4. **避免冲突**：规范的命名避免了文件名冲突和重复
