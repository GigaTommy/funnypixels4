#!/bin/bash
# 数据库恢复脚本

if [ $# -eq 0 ]; then
    echo "❌ 请指定要恢复的备份文件"
    echo "用法: $0 <backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ 备份文件不存在: $BACKUP_FILE"
    exit 1
fi

echo "��️ 开始数据库恢复..."

# 确认操作
read -p "⚠️ 这将覆盖现有数据库，确定继续吗？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 操作已取消"
    exit 1
fi

# 停止应用服务（如果有）
echo "⏹️ 停止应用服务..."
docker-compose stop backend 2>/dev/null || true

# 恢复PostgreSQL数据库
echo "📊 恢复PostgreSQL数据库..."

# 解压备份文件
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | docker exec -i pixelwar_postgres psql -U postgres -d pixelwar_dev
else
    docker exec -i pixelwar_postgres psql -U postgres -d pixelwar_dev < "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL恢复成功"
else
    echo "❌ PostgreSQL恢复失败"
    exit 1
fi

# 重启应用服务
echo "🔄 重启应用服务..."
docker-compose start backend 2>/dev/null || true

echo "�� 数据库恢复完成！"
echo "�� 数据库已恢复到备份状态"