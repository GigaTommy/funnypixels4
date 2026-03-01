@echo off
chcp 65001 >nul
echo 🚀 GPS绘制模拟测试脚本
echo ================================

echo.
echo 请选择测试模式:
echo 1. 快速测试 (单点绘制)
echo 2. 完整模拟 (轨迹绘制)
echo 3. 安装依赖
echo 4. 退出
echo.

set /p choice=请输入选择 (1-4): 

if "%choice%"=="1" (
    echo.
    echo 🔧 运行快速测试...
    node quick-gps-test.js
    pause
) else if "%choice%"=="2" (
    echo.
    echo 🔧 运行完整模拟...
    node simulate-gps-draw.js
    pause
) else if "%choice%"=="3" (
    echo.
    echo 📦 安装依赖...
    npm install axios socket.io-client
    echo ✅ 依赖安装完成！
    pause
) else if "%choice%"=="4" (
    echo 👋 再见！
    exit
) else (
    echo ❌ 无效选择，请重新运行脚本
    pause
)
