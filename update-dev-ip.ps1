# FunnyPixels 开发环境 IP 地址更新脚本 (PowerShell)
# 用法: .\update-dev-ip.ps1 -NewIP "192.168.1.100"

param(
    [Parameter(Mandatory=$true)]
    [string]$NewIP,

    [string]$OldIP = "192.168.0.3"
)

# 验证IP地址格式
if ($NewIP -notmatch '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
    Write-Host "❌ 错误: IP 地址格式无效" -ForegroundColor Red
    Write-Host "示例: .\update-dev-ip.ps1 -NewIP '192.168.1.100'" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n🔄 开始更新开发环境配置..." -ForegroundColor Blue
Write-Host "旧IP: $OldIP" -ForegroundColor Blue
Write-Host "新IP: $NewIP" -ForegroundColor Blue
Write-Host ""

# 备份函数
function Backup-File {
    param([string]$FilePath)

    if (Test-Path $FilePath) {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = "$FilePath.backup.$timestamp"
        Copy-Item $FilePath $backupPath
        Write-Host "✓ 已备份: $FilePath" -ForegroundColor Green
        return $true
    }
    return $false
}

# 更新函数
function Update-File {
    param(
        [string]$FilePath,
        [string]$OldValue,
        [string]$NewValue
    )

    if (Test-Path $FilePath) {
        (Get-Content $FilePath) -replace [regex]::Escape($OldValue), $NewValue | Set-Content $FilePath
        Write-Host "✓ 已更新: $FilePath" -ForegroundColor Green
        return $true
    } else {
        Write-Host "⚠️  文件不存在: $FilePath" -ForegroundColor Yellow
        return $false
    }
}

Write-Host "📦 正在备份配置文件..." -ForegroundColor Yellow

# 备份重要配置文件
Backup-File "FunnyPixelsApp\FunnyPixelsApp\Info.plist"
Backup-File "backend\.env"
Backup-File "frontend\.env"

Write-Host "`n🔧 正在更新配置..." -ForegroundColor Yellow

# 1. 更新 iOS App Info.plist
Write-Host "`n1️⃣  更新 iOS App 配置" -ForegroundColor Blue
Update-File "FunnyPixelsApp\FunnyPixelsApp\Info.plist" $OldIP $NewIP

# 2. 更新 Backend .env
Write-Host "`n2️⃣  更新 Backend 配置" -ForegroundColor Blue
if (Update-File "backend\.env" $OldIP $NewIP) {
    # 检查是否存在 LOCAL_IP 配置
    $content = Get-Content "backend\.env"
    if ($content -notmatch "^LOCAL_IP=") {
        Write-Host "   添加 LOCAL_IP 配置..." -ForegroundColor Yellow
        Add-Content "backend\.env" "`n# 手动指定局域网IP（开发环境）"
        Add-Content "backend\.env" "LOCAL_IP=$NewIP"
        Write-Host "   ✓ 已添加 LOCAL_IP=$NewIP" -ForegroundColor Green
    }
}

# 3. 更新 Frontend .env
Write-Host "`n3️⃣  更新 Frontend 配置" -ForegroundColor Blue
if (Update-File "frontend\.env" "localhost" $NewIP) {
    # 再次替换可能存在的旧IP
    Update-File "frontend\.env" $OldIP $NewIP
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ 配置更新完成！" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green

Write-Host "`n📋 新的开发环境地址:" -ForegroundColor Blue
Write-Host "   Backend API:    http://$NewIP`:3001"
Write-Host "   Frontend:       http://$NewIP`:3000"
Write-Host "   WebSocket:      ws://$NewIP`:3001"

Write-Host "`n⚡ 接下来需要执行的操作:" -ForegroundColor Yellow
Write-Host "   1. 重启 Backend:   " -NoNewline; Write-Host "cd backend && npm run dev" -ForegroundColor Blue
Write-Host "   2. 重启 Frontend:  " -NoNewline; Write-Host "cd frontend && npm run dev" -ForegroundColor Blue
Write-Host "   3. 重新编译 iOS:   在 Xcode 中执行 Clean Build (⇧⌘K) 然后 Build (⌘B)"

Write-Host "`n💾 备份文件已保存（后缀 .backup.YYYYMMDD_HHMMSS）" -ForegroundColor Yellow
Write-Host "   如需恢复，可以手动复制备份文件`n" -ForegroundColor Yellow
