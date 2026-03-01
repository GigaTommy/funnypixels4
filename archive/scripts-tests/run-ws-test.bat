@echo off
REM WebSocket压力测试运行脚本 - Windows
REM
REM 使用方法:
REM run-ws-test.bat [scenario]
REM
REM 场景:
REM   quick    - 快速测试 (1K用户, 30秒)
REM   normal   - 正常测试 (5K用户, 2分钟)
REM   full     - 完整测试 (10K用户, 5分钟)
REM   custom   - 自定义参数

setlocal

REM 检查k6是否安装
k6 version >nul 2>&1
if errorlevel 1 (
    echo ❌ K6未安装，请先安装K6:
    echo    choco install k6
    echo 或访问: https://k6.io/docs/get-started/installation/
    pause
    exit /b 1
)

REM 设置默认参数
set VUS=5000
set DURATION=2m
set SCENARIO=%1

REM 根据场景设置参数
if "%SCENARIO%"=="quick" (
    set VUS=1000
    set DURATION=30s
    echo 🚀 快速测试模式: 1K用户, 30秒
) else if "%SCENARIO%"=="normal" (
    set VUS=5000
    set DURATION=2m
    echo 🚀 正常测试模式: 5K用户, 2分钟
) else if "%SCENARIO%"=="full" (
    set VUS=10000
    set DURATION=5m
    echo 🚀 完整测试模式: 10K用户, 5分钟
) else if "%SCENARIO%"=="custom" (
    set /p VUS="请输入并发用户数 (默认5000): "
    if "%VUS%"=="" set VUS=5000
    set /p DURATION="请输入测试时长 (默认2m): "
    if "%DURATION%"=="" set DURATION=2m
    echo 🚀 自定义测试模式: %VUS%用户, %DURATION%
) else (
    echo 🚀 使用默认参数: 5K用户, 2分钟
    echo 可用场景: quick, normal, full, custom
)

echo.
echo 📊 测试配置:
echo    并发用户: %VUS%
echo    测试时长: %DURATION%
echo    WebSocket: ws://localhost:3001
echo    每用户瓦片: 20
echo    每秒更新: 500
echo.

REM 检查服务器是否运行
curl -s http://localhost:3001/api/health >nul 2>&1
if errorlevel 1 (
    echo ⚠️ 警告: 无法连接到服务器 (localhost:3001)
    echo 请确保服务器正在运行
    echo.
    set /p CONTINUE="是否继续测试? (y/N): "
    if /i not "%CONTINUE%"=="y" exit /b 1
)

echo 🏁 开始测试...
echo.

REM 运行测试
k6 run --vus %VUS% --duration %DURATION% ws-room-test.js

echo.
echo ✅ 测试完成！
echo.
echo 💡 提示:
echo    - 查看详细日志了解性能瓶颈
echo    - 使用 Grafana 可视化测试结果
echo    - 运行 k6 archive --output json=results.json 保存结果

pause