# 从 modood/administrative-divisions-of-china 下载中国行政区划数据
# 数据源：https://github.com/modood/administrative-divisions-of-China
# 基于国家统计局官方数据，包含五级行政区划

Write-Host "🗺️ 开始下载中国行政区划数据..." -ForegroundColor Green
Write-Host "📚 数据源: modood/administrative-divisions-of-china" -ForegroundColor Cyan
Write-Host "📊 包含: 省级、地级、县级、乡级、村级数据" -ForegroundColor Cyan
Write-Host ""

# 创建数据目录
$dataDir = "data"
if (!(Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir
    Write-Host "📁 创建数据目录: $dataDir" -ForegroundColor Yellow
}

# 切换到数据目录
Set-Location $dataDir

Write-Host "📥 开始下载文件..." -ForegroundColor Green

# 1. 省级行政区划数据 (31个)
Write-Host "`n📦 下载省级数据..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/provinces.json" -OutFile "provinces.json"
Write-Host "✅ provinces.json 下载完成" -ForegroundColor Green

# 2. 地级行政区划数据 (342个)
Write-Host "`n📦 下载地级数据..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/cities.json" -OutFile "cities.json"
Write-Host "✅ cities.json 下载完成" -ForegroundColor Green

# 3. 县级行政区划数据 (2978个)
Write-Host "`n📦 下载县级数据..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/areas.json" -OutFile "areas.json"
Write-Host "✅ areas.json 下载完成" -ForegroundColor Green

# 4. 乡级行政区划数据 (41352个)
Write-Host "`n📦 下载乡级数据..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/streets.json" -OutFile "streets.json"
Write-Host "✅ streets.json 下载完成" -ForegroundColor Green

# 5. 村级行政区划数据 (约50万个)
Write-Host "`n📦 下载村级数据..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/villages.json" -OutFile "villages.json"
Write-Host "✅ villages.json 下载完成" -ForegroundColor Green

# 6. 联动数据 - 省份城市二级联动
Write-Host "`n📦 下载二级联动数据..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pc.json" -OutFile "pc.json"
Write-Host "✅ pc.json 下载完成" -ForegroundColor Green

# 7. 联动数据 - 省份城市区县三级联动
Write-Host "`n📦 下载三级联动数据..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pca.json" -OutFile "pca.json"
Write-Host "✅ pca.json 下载完成" -ForegroundColor Green

# 8. 联动数据 - 省份城市区县乡镇四级联动
Write-Host "`n📦 下载四级联动数据..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pcas.json" -OutFile "pcas.json"
Write-Host "✅ pcas.json 下载完成" -ForegroundColor Green

# 9. 带编码的联动数据
Write-Host "`n📦 下载带编码的联动数据..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pc-code.json" -OutFile "pc-code.json"
Write-Host "✅ pc-code.json 下载完成" -ForegroundColor Green

Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pca-code.json" -OutFile "pca-code.json"
Write-Host "✅ pca-code.json 下载完成" -ForegroundColor Green

Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pcas-code.json" -OutFile "pcas-code.json"
Write-Host "✅ pcas-code.json 下载完成" -ForegroundColor Green

# 验证下载的文件
Write-Host "`n🔍 验证下载的文件..." -ForegroundColor Yellow
$files = @("provinces.json", "cities.json", "areas.json", "streets.json", "villages.json", "pc.json", "pca.json", "pcas.json", "pc-code.json", "pca-code.json", "pcas-code.json")

foreach ($file in $files) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $sizeKB = [math]::Round($size / 1KB, 2)
        Write-Host "✅ $file - $sizeKB KB" -ForegroundColor Green
    } else {
        Write-Host "❌ $file - 下载失败" -ForegroundColor Red
    }
}

# 显示数据统计
Write-Host "`n📊 数据统计:" -ForegroundColor Cyan
try {
    $provinces = Get-Content "provinces.json" | ConvertFrom-Json
    Write-Host "   省级: $($provinces.Count) 个" -ForegroundColor White
    
    $cities = Get-Content "cities.json" | ConvertFrom-Json
    Write-Host "   地级: $($cities.Count) 个" -ForegroundColor White
    
    $areas = Get-Content "areas.json" | ConvertFrom-Json
    Write-Host "   县级: $($areas.Count) 个" -ForegroundColor White
    
    $streets = Get-Content "streets.json" | ConvertFrom-Json
    Write-Host "   乡级: $($streets.Count) 个" -ForegroundColor White
    
    $villages = Get-Content "villages.json" | ConvertFrom-Json
    Write-Host "   村级: $($villages.Count) 个" -ForegroundColor White
} catch {
    Write-Host "⚠️ 无法统计数据条数" -ForegroundColor Yellow
}

Write-Host "`n✅ 所有数据下载完成！" -ForegroundColor Green
Write-Host "💡 接下来可以运行以下命令导入数据:" -ForegroundColor Cyan
Write-Host "   node scripts/import-region-data.js modood ./data/provinces.json" -ForegroundColor White
Write-Host "   node scripts/import-region-data.js modood ./data/cities.json" -ForegroundColor White
Write-Host "   node scripts/import-region-data.js modood ./data/areas.json" -ForegroundColor White

# 返回上级目录
Set-Location ..
