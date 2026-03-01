@echo off
REM FunnyPixels 开发环境启动脚本 (Windows)
echo 🚀 启动 FunnyPixels 开发环境...

REM 检查是否安装了依赖
if not exist "node_modules" (
    echo 📦 安装根目录依赖...
    npm install
)

if not exist "frontend\node_modules" (
    echo 📦 安装前端依赖...
    cd frontend && npm install && cd ..
)

if not exist "backend\node_modules" (
    echo 📦 安装后端依赖...
    cd backend && npm install && cd ..
)

REM 启动后端服务
echo 🔧 启动后端服务 (端口 3001)...
start "Backend" cmd /k "cd backend && npm run dev"

REM 等待后端启动
timeout /t 3 /nobreak > nul

REM 启动前端服务
echo 🎨 启动前端服务 (端口 5173)...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo ✅ 开发环境启动完成！
echo 📱 前端地址: http://localhost:5173
echo 🔧 后端地址: http://localhost:3001
echo.
echo 按任意键退出...
pause > nul
