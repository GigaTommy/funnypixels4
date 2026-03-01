@echo off
REM PostGIS安装脚本
REM 适用于Windows系统

echo 🗺️ 开始安装PostGIS扩展...

REM 检查是否安装了PostgreSQL
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 未找到PostgreSQL，请先安装PostgreSQL
    echo 💡 下载地址: https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)

echo 📦 请手动安装PostGIS扩展...
echo 💡 下载地址: https://postgis.net/install/
echo 💡 选择与你的PostgreSQL版本匹配的PostGIS版本

REM 在数据库中启用PostGIS扩展
echo 🔧 在数据库中启用PostGIS扩展...
psql -U postgres -d funnypixels -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -U postgres -d funnypixels -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"

echo ✅ PostGIS扩展已启用

REM 验证安装
echo 🔍 验证PostGIS安装...
psql -U postgres -d funnypixels -c "SELECT PostGIS_Version();"

echo 🎉 PostGIS安装和配置完成！
pause
