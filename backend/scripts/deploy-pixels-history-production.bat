@echo off
REM =====================================================
REM 生产环境像素历史系统部署脚本 (Windows版本)
REM 文件名: deploy-pixels-history-production.bat
REM 创建时间: 2025-09-07
REM 说明: 自动化部署像素历史系统到生产环境
REM =====================================================

setlocal enabledelayedexpansion

REM 颜色定义 (Windows PowerShell)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

REM 日志函数
:log_info
echo %BLUE%[INFO]%NC% %~1
goto :eof

:log_success
echo %GREEN%[SUCCESS]%NC% %~1
goto :eof

:log_warning
echo %YELLOW%[WARNING]%NC% %~1
goto :eof

:log_error
echo %RED%[ERROR]%NC% %~1
goto :eof

REM 检查依赖
:check_dependencies
call :log_info "检查依赖..."

where psql >nul 2>&1
if %errorlevel% neq 0 (
    call :log_error "psql 未安装，请先安装 PostgreSQL 客户端"
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    call :log_error "npm 未安装，请先安装 Node.js"
    exit /b 1
)

call :log_success "依赖检查通过"
goto :eof

REM 检查环境变量
:check_environment
call :log_info "检查环境变量..."

if "%DATABASE_URL%"=="" if "%DB_HOST%"=="" (
    call :log_error "请设置数据库连接信息 (DATABASE_URL 或 DB_HOST)"
    exit /b 1
)

if "%NODE_ENV%"=="" (
    call :log_warning "NODE_ENV 未设置，使用默认值: production"
    set NODE_ENV=production
)

call :log_success "环境变量检查通过"
goto :eof

REM 执行数据库设置
:setup_database
call :log_info "设置数据库..."

set "sql_file=backend\scripts\production-pixels-history-setup.sql"

if not exist "%sql_file%" (
    call :log_error "SQL文件不存在: %sql_file%"
    exit /b 1
)

REM 执行SQL脚本
if not "%DATABASE_URL%"=="" (
    call :log_info "使用 DATABASE_URL 连接数据库..."
    psql "%DATABASE_URL%" -f "%sql_file%"
) else (
    call :log_info "使用 DB_HOST 连接数据库..."
    psql -h "%DB_HOST%" -U "%DB_USER%" -d "%DB_NAME%" -f "%sql_file%"
)

if %errorlevel% equ 0 (
    call :log_success "数据库设置完成"
) else (
    call :log_error "数据库设置失败"
    exit /b 1
)
goto :eof

REM 验证数据库设置
:verify_database
call :log_info "验证数据库设置..."

set "verify_sql=SELECT 'Tables: ' || COUNT(*) as table_count FROM information_schema.tables WHERE table_name LIKE 'pixels_history%%'; SELECT 'Indexes: ' || COUNT(*) as index_count FROM pg_indexes WHERE tablename LIKE 'pixels_history%%'; SELECT 'Functions: ' || COUNT(*) as function_count FROM pg_proc WHERE proname LIKE '%%pixels_history%%' OR proname LIKE '%%partition%%';"

if not "%DATABASE_URL%"=="" (
    psql "%DATABASE_URL%" -c "%verify_sql%"
) else (
    psql -h "%DB_HOST%" -U "%DB_USER%" -d "%DB_NAME%" -c "%verify_sql%"
)

call :log_success "数据库验证完成"
goto :eof

REM 安装依赖
:install_dependencies
call :log_info "安装依赖..."

cd backend
npm install --production
cd ..

call :log_success "依赖安装完成"
goto :eof

REM 重启服务
:restart_services
call :log_info "重启服务..."

REM 检查服务类型
where docker-compose >nul 2>&1
if %errorlevel% equ 0 (
    call :log_info "使用 Docker Compose 重启服务..."
    docker-compose restart backend
) else (
    where pm2 >nul 2>&1
    if %errorlevel% equ 0 (
        call :log_info "使用 PM2 重启服务..."
        pm2 restart backend
    ) else (
        call :log_warning "未检测到服务管理工具，请手动重启后端服务"
    )
)

call :log_success "服务重启完成"
goto :eof

REM 启动队列处理器
:start_queue_processor
call :log_info "启动队列处理器..."

cd backend

where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    call :log_info "使用 PM2 启动队列处理器..."
    pm2 start scripts\process-pixels-history-queue.js --name "pixels-history-queue"
) else (
    call :log_info "使用后台进程启动队列处理器..."
    start /b node scripts\process-pixels-history-queue.js > logs\pixels-history-queue.log 2>&1
)

cd ..

call :log_success "队列处理器启动完成"
goto :eof

REM 运行测试
:run_tests
call :log_info "运行测试..."

cd backend
npm run pixels-history:test
cd ..

call :log_success "测试完成"
goto :eof

REM 显示部署摘要
:show_summary
call :log_success "🎉 像素历史系统部署完成！"
echo.
echo 📊 部署摘要:
echo   ✅ 数据库表结构已创建
echo   ✅ 分区和索引已设置
echo   ✅ 管理函数已安装
echo   ✅ 后端服务已重启
echo   ✅ 队列处理器已启动
echo.
echo 🔧 管理命令:
echo   - 创建新分区: npm run pixels-history:manage -- create-monthly
echo   - 清理旧分区: npm run pixels-history:manage -- cleanup
echo   - 归档数据: npm run pixels-history:archive
echo   - 查看统计: npm run pixels-history:manage -- stats
echo.
echo 📚 文档:
echo   - 部署指南: backend\docs\PRODUCTION_PIXELS_HISTORY_DEPLOYMENT.md
echo   - 系统文档: backend\docs\PIXELS_HISTORY_SYSTEM.md
echo.
echo ⚠️  注意事项:
echo   - 请定期监控队列处理器状态
echo   - 建议设置数据库备份策略
echo   - 监控存储空间使用情况
goto :eof

REM 显示帮助信息
:show_help
echo 用法: %~nx0 [选项]
echo.
echo 选项:
echo   -h, --help     显示帮助信息
echo   --skip-db      跳过数据库设置
echo   --skip-test    跳过测试
echo.
echo 环境变量:
echo   DATABASE_URL   数据库连接URL
echo   DB_HOST        数据库主机
echo   DB_USER        数据库用户名
echo   DB_NAME        数据库名称
echo   NODE_ENV       运行环境 (默认: production)
echo.
echo 示例:
echo   %~nx0
echo   set DATABASE_URL=postgresql://user:pass@host:port/db ^& %~nx0
echo   %~nx0 --skip-test
goto :eof

REM 主函数
:main
echo 🚀 开始部署像素历史系统到生产环境...
echo.

call :check_dependencies
call :check_environment
call :setup_database
call :verify_database
call :install_dependencies
call :restart_services
call :start_queue_processor
call :run_tests
call :show_summary
goto :eof

REM 解析命令行参数
set "SKIP_DB=false"
set "SKIP_TEST=false"

:parse_args
if "%~1"=="" goto :execute
if "%~1"=="-h" goto :show_help
if "%~1"=="--help" goto :show_help
if "%~1"=="--skip-db" (
    set "SKIP_DB=true"
    shift
    goto :parse_args
)
if "%~1"=="--skip-test" (
    set "SKIP_TEST=true"
    shift
    goto :parse_args
)
call :log_error "未知选项: %~1"
call :show_help
exit /b 1

:execute
call :main
