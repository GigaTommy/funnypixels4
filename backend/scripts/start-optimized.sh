#!/bin/bash

# 像素绘制系统优化启动脚本
# 启动所有优化服务，包括Redis Stream、瓦片订阅、排行榜缓存等

set -e

echo "🚀 启动优化后的像素绘制系统..."

# 检查环境变量
check_env() {
    echo "🔍 检查环境变量..."
    
    required_vars=(
        "NODE_ENV"
        "PORT"
        "DB_HOST"
        "DB_USER"
        "DB_PASSWORD"
        "DB_NAME"
        "REDIS_HOST"
        "JWT_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo "❌ 缺少必需的环境变量: $var"
            exit 1
        fi
    done
    
    echo "✅ 环境变量检查通过"
}

# 检查依赖服务
check_dependencies() {
    echo "🔍 检查依赖服务..."
    
    # 检查数据库连接
    echo "📊 检查数据库连接..."
    if ! node -e "
        const knex = require('knex')(require('./knexfile').development);
        knex.raw('SELECT 1').then(() => {
            console.log('✅ 数据库连接正常');
            process.exit(0);
        }).catch(err => {
            console.error('❌ 数据库连接失败:', err.message);
            process.exit(1);
        });
    "; then
        echo "❌ 数据库连接失败"
        exit 1
    fi
    
    # 检查Redis连接
    echo "🔴 检查Redis连接..."
    if ! node -e "
        const redis = require('redis');
        const client = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379')
            },
            password: process.env.REDIS_PASSWORD || undefined
        });
        client.connect().then(() => client.ping()).then(() => {
            console.log('✅ Redis连接正常');
            client.quit();
            process.exit(0);
        }).catch(err => {
            console.error('❌ Redis连接失败:', err.message);
            process.exit(1);
        });
    "; then
        echo "❌ Redis连接失败"
        exit 1
    fi
    
    echo "✅ 依赖服务检查通过"
}

# 运行数据库迁移
run_migrations() {
    echo "🔄 运行数据库迁移..."
    
    if npm run migrate; then
        echo "✅ 数据库迁移完成"
    else
        echo "❌ 数据库迁移失败"
        exit 1
    fi
}

# 预热缓存
warmup_cache() {
    echo "🔥 预热缓存..."
    
    node -e "
        const CacheService = require('./src/services/cacheService');
        const { redis } = require('./src/config/redis');
        
        const cacheService = new CacheService();
        
        // 预热排行榜缓存
        Promise.all([
            cacheService.updateLeaderboard('day'),
            cacheService.updateLeaderboard('hour'),
            cacheService.updateLeaderboard('week')
        ]).then(() => {
            console.log('✅ 缓存预热完成');
            process.exit(0);
        }).catch(err => {
            console.error('❌ 缓存预热失败:', err.message);
            process.exit(1);
        });
    "
}

# 启动后台任务
start_background_workers() {
    echo "🔄 启动后台任务..."
    
    # 启动排行榜计算任务
    node -e "
        const CacheService = require('./src/services/cacheService');
        
        const cacheService = new CacheService();
        
        console.log('✅ 排行榜计算任务已启动');
        
        // 定期更新排行榜
        setInterval(async () => {
            try {
                await cacheService.updateLeaderboard('day');
                await cacheService.updateLeaderboard('hour');
                await cacheService.updateLeaderboard('week');
                console.log('📊 排行榜已更新');
            } catch (error) {
                console.error('❌ 排行榜更新失败:', error.message);
            }
        }, 60000); // 每分钟更新一次
        
        // 保持进程运行
        process.on('SIGINT', () => {
            console.log('🛑 排行榜计算任务已停止');
            process.exit(0);
        });
    " &
    
    LEADERBOARD_PID=$!
    echo "📊 排行榜计算任务PID: $LEADERBOARD_PID"
    
    # 启动Redis Stream持久化任务
    node -e "
        const PixelDrawService = require('./src/services/pixelDrawService');
        const SocketManager = require('./src/services/socketManager');
        
        // 创建模拟的SocketManager实例
        const mockSocketManager = {
            broadcastTileUpdate: () => Promise.resolve(),
            getConnectedClients: () => []
        };
        
        const pixelDrawService = new PixelDrawService(mockSocketManager);
        
        console.log('✅ Redis Stream持久化任务已启动');
        
        // 定期刷新Stream到数据库
        setInterval(async () => {
            try {
                await pixelDrawService.flushStreamToDatabase();
                console.log('📝 Stream已刷新到数据库');
            } catch (error) {
                console.error('❌ Stream刷新失败:', error.message);
            }
        }, 300000); // 每5分钟刷新一次
        
        // 保持进程运行
        process.on('SIGINT', () => {
            console.log('🛑 Redis Stream持久化任务已停止');
            process.exit(0);
        });
    " &
    
    STREAM_PID=$!
    echo "📝 Redis Stream持久化任务PID: $STREAM_PID"
    
    # 保存PID文件
    echo $LEADERBOARD_PID > /tmp/leaderboard.pid
    echo $STREAM_PID > /tmp/stream.pid
}

# 启动主服务
start_main_service() {
    echo "🌐 启动主服务..."
    
    # 设置优化相关的环境变量
    export REDIS_STREAM_KEY=stream:pixels
    export REDIS_BATCH_SIZE=100
    export REDIS_FLUSH_INTERVAL=300000
    export TILE_BATCH_TIMEOUT=50
    export TILE_CACHE_TTL=3600
    export LEADERBOARD_UPDATE_INTERVAL=60000
    export LEADERBOARD_CACHE_TTL=3600
    export MAX_CONCURRENT_CONNECTIONS=1000
    export MAX_REDIS_MEMORY=52428800
    
    # 启动主服务
    npm start &
    
    MAIN_PID=$!
    echo "🌐 主服务PID: $MAIN_PID"
    echo $MAIN_PID > /tmp/main.pid
    
    # 等待服务启动
    echo "⏳ 等待服务启动..."
    sleep 5
    
    # 检查服务状态
    if curl -f http://localhost:${PORT:-3001}/health > /dev/null 2>&1; then
        echo "✅ 主服务启动成功"
    else
        echo "❌ 主服务启动失败"
        exit 1
    fi
}

# 显示服务状态
show_status() {
    echo ""
    echo "📊 服务状态"
    echo "=" .repeat(40)
    
    if [ -f /tmp/main.pid ]; then
        MAIN_PID=$(cat /tmp/main.pid)
        if kill -0 $MAIN_PID 2>/dev/null; then
            echo "🌐 主服务: 运行中 (PID: $MAIN_PID)"
        else
            echo "🌐 主服务: 已停止"
        fi
    fi
    
    if [ -f /tmp/leaderboard.pid ]; then
        LEADERBOARD_PID=$(cat /tmp/leaderboard.pid)
        if kill -0 $LEADERBOARD_PID 2>/dev/null; then
            echo "📊 排行榜任务: 运行中 (PID: $LEADERBOARD_PID)"
        else
            echo "📊 排行榜任务: 已停止"
        fi
    fi
    
    if [ -f /tmp/stream.pid ]; then
        STREAM_PID=$(cat /tmp/stream.pid)
        if kill -0 $STREAM_PID 2>/dev/null; then
            echo "📝 Stream任务: 运行中 (PID: $STREAM_PID)"
        else
            echo "📝 Stream任务: 已停止"
        fi
    fi
    
    echo ""
    echo "🔗 服务地址:"
    echo "- 主服务: http://localhost:${PORT:-3001}"
    echo "- 健康检查: http://localhost:${PORT:-3001}/health"
    echo "- API文档: http://localhost:${PORT:-3001}/api/docs"
    
    echo ""
    echo "📈 优化特性:"
    echo "- ✅ 瓦片订阅系统"
    echo "- ✅ Redis Stream缓存"
    echo "- ✅ 排行榜后台计算"
    echo "- ✅ 增量更新广播"
    echo "- ✅ 自动持久化"
    echo "- ✅ 内存优化"
}

# 清理函数
cleanup() {
    echo ""
    echo "🛑 正在停止服务..."
    
    # 停止主服务
    if [ -f /tmp/main.pid ]; then
        MAIN_PID=$(cat /tmp/main.pid)
        if kill -0 $MAIN_PID 2>/dev/null; then
            kill $MAIN_PID
            echo "🌐 主服务已停止"
        fi
        rm -f /tmp/main.pid
    fi
    
    # 停止排行榜任务
    if [ -f /tmp/leaderboard.pid ]; then
        LEADERBOARD_PID=$(cat /tmp/leaderboard.pid)
        if kill -0 $LEADERBOARD_PID 2>/dev/null; then
            kill $LEADERBOARD_PID
            echo "📊 排行榜任务已停止"
        fi
        rm -f /tmp/leaderboard.pid
    fi
    
    # 停止Stream任务
    if [ -f /tmp/stream.pid ]; then
        STREAM_PID=$(cat /tmp/stream.pid)
        if kill -0 $STREAM_PID 2>/dev/null; then
            kill $STREAM_PID
            echo "📝 Stream任务已停止"
        fi
        rm -f /tmp/stream.pid
    fi
    
    echo "✅ 所有服务已停止"
}

# 主函数
main() {
    echo "🎯 像素绘制系统优化启动脚本"
    echo "=" .repeat(50)
    
    # 设置信号处理
    trap cleanup SIGINT SIGTERM
    
    # 检查环境
    check_env
    
    # 检查依赖
    check_dependencies
    
    # 运行迁移
    run_migrations
    
    # 预热缓存
    warmup_cache
    
    # 启动后台任务
    start_background_workers
    
    # 启动主服务
    start_main_service
    
    # 显示状态
    show_status
    
    echo ""
    echo "🎉 系统启动完成！"
    echo "按 Ctrl+C 停止所有服务"
    
    # 等待信号
    wait
}

# 运行主函数
main "$@"
