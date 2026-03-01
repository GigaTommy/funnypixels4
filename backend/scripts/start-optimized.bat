@echo off
chcp 65001 >nul
echo 🎯 像素绘制系统优化启动脚本 (Windows)
echo ================================================
echo.

:: 设置错误处理
setlocal enabledelayedexpansion

:: 清理函数
:cleanup
echo.
echo 🛑 正在停止所有服务...
taskkill /f /im node.exe >nul 2>&1
echo ✅ 清理完成
exit /b

:: 检查环境变量
:check_env
echo 📋 检查环境变量...
if not exist ".env" (
    echo ❌ .env文件不存在，请复制env.example并配置
    pause
    exit /b 1
)
echo ✅ 环境变量检查通过
echo.

:: 检查依赖
:check_dependencies
echo 🔍 检查依赖服务...
echo - 检查PostgreSQL...
pg_isready -h %DB_HOST% -p %DB_PORT% >nul 2>&1
if errorlevel 1 (
    echo ❌ PostgreSQL连接失败，请确保数据库服务正在运行
    pause
    exit /b 1
)
echo ✅ PostgreSQL连接正常

echo - 检查Redis...
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo ❌ Redis连接失败，请确保Redis服务正在运行
    pause
    exit /b 1
)
echo ✅ Redis连接正常
echo.

:: 运行数据库迁移
:run_migrations
echo 🗄️ 运行数据库迁移...
npm run migrate
if errorlevel 1 (
    echo ❌ 数据库迁移失败
    pause
    exit /b 1
)
echo ✅ 数据库迁移完成
echo.

:: 预热缓存
:warmup_cache
echo 🔥 预热缓存...
node -e "
const CacheService = require('../src/services/cacheService');

async function warmup() {
  try {
    console.log('正在预热排行榜缓存...');
    const cacheService = new CacheService();
    await cacheService.updateLeaderboard('day');
    await cacheService.updateLeaderboard('hour');
    await cacheService.updateLeaderboard('week');
    console.log('✅ 缓存预热完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 缓存预热失败:', error);
    process.exit(1);
  }
}
warmup();
"
if errorlevel 1 (
    echo ❌ 缓存预热失败
    pause
    exit /b 1
)
echo ✅ 缓存预热完成
echo.

:: 启动后台工作进程
:start_background_workers
echo 🔄 启动后台工作进程...
start "Redis Stream Worker" cmd /c "node -e \"
const PixelDrawService = require('../src/services/pixelDrawService');

console.log('🔄 Redis Stream Worker 启动...');
// 创建模拟的SocketManager实例
const mockSocketManager = {
  broadcastTileUpdate: () => Promise.resolve(),
  getConnectedClients: () => []
};
const pixelDrawService = new PixelDrawService(mockSocketManager);
setInterval(async () => {
  try {
    await pixelDrawService.flushStreamToDatabase();
  } catch (error) {
    console.error('Stream flush error:', error);
  }
}, 300000); // 5分钟
\""

start "Leaderboard Worker" cmd /c "node -e \"
const CacheService = require('../src/services/cacheService');

console.log('🏆 Leaderboard Worker 启动...');
const cacheService = new CacheService();
setInterval(async () => {
  try {
    await cacheService.updateLeaderboard('day');
    await cacheService.updateLeaderboard('hour');
    await cacheService.updateLeaderboard('week');
  } catch (error) {
    console.error('Leaderboard update error:', error);
  }
}, 60000); // 1分钟
\""

echo ✅ 后台工作进程已启动
echo.

:: 启动主服务
:start_main_service
echo 🚀 启动主服务...
echo - 端口: %PORT%
echo - 环境: %NODE_ENV%
echo - 优化模式: 已启用
echo.

npm start

:: 主程序
:main
echo 🎯 像素绘制系统优化启动脚本
echo ================================================
trap cleanup SIGINT SIGTERM

call check_env
call check_dependencies
call run_migrations
call warmup_cache
call start_background_workers
call start_main_service

echo.
echo 🎉 系统启动完成！
echo 按 Ctrl+C 停止所有服务
pause
