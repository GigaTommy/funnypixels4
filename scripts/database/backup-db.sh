#!/bin/bash
# 数据库备份脚本

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="pixelwar_backup_${DATE}.sql"

echo "��️ 开始数据库备份..."

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份PostgreSQL数据库
echo "📊 备份PostgreSQL数据库..."
docker exec pixelwar_postgres pg_dump -U postgres pixelwar_dev > "$BACKUP_DIR/$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL备份成功: $BACKUP_DIR/$BACKUP_FILE"
    
    # 压缩备份文件
    gzip "$BACKUP_DIR/$BACKUP_FILE"
    echo "📦 备份文件已压缩: $BACKUP_DIR/$BACKUP_FILE.gz"
    
    # 显示备份文件大小
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE.gz" | cut -f1)
    echo "📏 备份文件大小: $BACKUP_SIZE"
else
    echo "❌ PostgreSQL备份失败"
    exit 1
fi

# 备份Redis数据（可选）
echo "🔴 备份Redis数据..."
docker exec pixelwar_redis redis-cli BGSAVE
sleep 2
docker cp pixelwar_redis:/data/dump.rdb "$BACKUP_DIR/redis_backup_${DATE}.rdb"

if [ $? -eq 0 ]; then
    echo "✅ Redis备份成功: $BACKUP_DIR/redis_backup_${DATE}.rdb"
else
    echo "⚠️ Redis备份失败（可选）"
fi

echo "�� 数据库备份完成！"
echo "📁 备份文件位置: $BACKUP_DIR/"