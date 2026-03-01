#!/bin/bash

# 批量修复迁移文件中的列冲突问题
# 为所有添加列的迁移添加存在性检查

echo "🔧 开始批量修复迁移文件..."

MIGRATIONS_DIR="src/database/migrations"

# 查找所有可能需要修复的迁移文件
# 这些文件包含 alterTable 和直接的列添加操作
echo "📋 检查需要修复的迁移文件..."

# 列出所有迁移文件
for file in $MIGRATIONS_DIR/*.js; do
    filename=$(basename "$file")
    echo "检查: $filename"

    # 检查文件是否包含 alterTable 和列添加操作
    if grep -q "alterTable" "$file" && grep -q "table\.string\|table\.text\|table\.uuid\|table\.integer" "$file"; then
        echo "  ⚠️  可能需要修复"
    fi
done

echo ""
echo "✅ 检查完成"
echo ""
echo "💡 手动修复步骤："
echo "1. 对于每个失败的迁移，添加列存在性检查"
echo "2. 使用以下模板："
echo ""
cat <<'EOF'
exports.up = async function(knex) {
  const columnExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'table_name'
      AND column_name = 'column_name'
    );
  `);

  if (!columnExists.rows[0].exists) {
    // 添加列的代码
    await knex.schema.alterTable('table_name', function(table) {
      table.string('column_name');
    });
  }
};
EOF
echo ""
echo "3. 然后运行: npm run migrate"
echo ""
