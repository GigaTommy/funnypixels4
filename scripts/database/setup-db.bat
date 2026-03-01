@echo off
REM /pixelwar/scripts/setup-db.bat

echo 🚀 开始设置数据库...

REM 检查Docker是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker未运行，请先启动Docker
    pause
    exit /b 1
)

REM 启动数据库服务
echo 🐘 启动PostgreSQL和Redis...
docker-compose up -d postgres redis

REM 等待数据库启动
echo ⏳ 等待数据库启动...
timeout /t 10 /nobreak >nul

REM 安装依赖
echo 📦 安装后端依赖...
cd backend
call npm install

REM 复制环境变量文件
if not exist .env (
    echo 📝 创建环境变量文件...
    copy env.example .env
)

REM 运行数据库迁移
echo 🗄️ 运行数据库迁移...
call npm run migrate

REM 运行种子数据
echo 🌱 创建种子数据...
call npm run seed

echo ✅ 数据库设置完成！
echo 📊 PostgreSQL: localhost:5432
echo 🔴 Redis: localhost:6379
echo 🚀 后端API: http://localhost:3001

pause
