#!/bin/bash

# PostGIS安装脚本
# 适用于Ubuntu/Debian系统

echo "🗺️ 开始安装PostGIS扩展..."

# 更新包列表
echo "📦 更新包列表..."
sudo apt update

# 安装PostGIS和相关包
echo "📦 安装PostGIS和相关包..."
sudo apt install -y postgresql-15-postgis-3 postgresql-15-postgis-3-scripts

# 或者如果你使用PostgreSQL 14
# sudo apt install -y postgresql-14-postgis-3 postgresql-14-postgis-3-scripts

echo "✅ PostGIS安装完成"

# 在数据库中启用PostGIS扩展
echo "🔧 在数据库中启用PostGIS扩展..."
sudo -u postgres psql -d funnypixels -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql -d funnypixels -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"

echo "✅ PostGIS扩展已启用"

# 验证安装
echo "🔍 验证PostGIS安装..."
sudo -u postgres psql -d funnypixels -c "SELECT PostGIS_Version();"

echo "🎉 PostGIS安装和配置完成！"
