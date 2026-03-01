@echo off
REM 瓦片合成服务压力测试运行脚本
REM
REM 使用方法:
REM run-tile-test.bat [type]
REM
REM 类型:
REM   k6       - 使用K6进行完整测试
REM   simple   - 使用Node.js进行简单测试

setlocal

set TYPE=%1
if "%TYPE%"=="" set TYPE=simple

echo.
echo ====================================
echo 瓦片合成服务压力测试
echo ====================================
echo.

REM 检查服务器是否运行
echo 检查服务器状态...
curl -s http://localhost:3001/api/health >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 服务器未运行
    echo 请先启动服务器: cd backend && npm start
    pause
    exit /b 1
)

echo ✅ 服务器运行正常
echo.

if "%TYPE%"=="k6" (
    echo 📋 使用K6进行压力测试
    echo.

    REM 检查k6是否安装
    k6 version >nul 2>&1
    if errorlevel 1 (
        echo ❌ 错误: K6未安装
        echo 请安装K6: choco install k6
        echo 或访问: https://k6.io/docs/get-started/installation/
        pause
        exit /b 1
    )

    echo 🚀 开始测试...
    echo 测试配置: 200并发, 5000瓦片, 5分钟
    echo.

    k6 run --vus 200 --duration 5m tile-composition-stress.js

) else if "%TYPE%"=="simple" (
    echo 📋 使用Node.js进行简单测试
    echo.

    echo 🚀 开始测试...
    echo 测试配置: 50并发, 1000请求
    echo.

    node tile-test-simple.js

) else (
    echo ❌ 错误: 无效的测试类型
    echo 可用类型: k6, simple
    pause
    exit /b 1
)

echo.
echo ✅ 测试完成！
pause