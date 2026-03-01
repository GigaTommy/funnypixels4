@echo off
echo 开始初始化生产环境Seed数据...
echo.

cd /d "%~dp0.."

echo 检查Node.js环境...
node --version
if %errorlevel% neq 0 (
    echo 错误: 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

echo.
echo 执行Seed数据初始化...
node scripts/init-production-seed.js

echo.
echo Seed数据初始化完成！
pause
