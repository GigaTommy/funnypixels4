#!/bin/bash

# FunnyPixels GPS 功能自动化测试脚本
# 使用方法：./test-gps-automation.sh

set -e

echo "========================================"
echo "🚀 FunnyPixels GPS 功能自动化测试"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步骤 1: 检查 Xcode 是否运行
echo "📌 步骤 1/5: 检查 Xcode 运行状态"
if pgrep -x "Xcode" > /dev/null; then
    echo -e "${GREEN}✅ Xcode 正在运行${NC}"
else
    echo -e "${YELLOW}⚠️  Xcode 未运行，请先启动 Xcode 并运行应用${NC}"
    echo "然后重新运行此脚本"
    exit 1
fi

echo ""

# 步骤 2: 检查模拟器是否运行
echo "📌 步骤 2/5: 检查 iOS 模拟器"
if pgrep -x "Simulator" > /dev/null; then
    echo -e "${GREEN}✅ iOS 模拟器正在运行${NC}"
else
    echo -e "${YELLOW}⚠️  iOS 模拟器未运行${NC}"
    echo "请在 Xcode 中运行应用（⌘ Command + R）"
    exit 1
fi

echo ""

# 步骤 3: 创建测试用的 GPX 文件
echo "📌 步骤 3/5: 创建测试 GPX 文件"
cat > /tmp/test-location.gpx <<EOF
<?xml version="1.0"?>
<gpx version="1.1" creator="FunnyPixels Test">
  <wpt lat="39.9042" lon="116.4074">
    <name>北京天安门</name>
    <time>2024-01-08T10:00:00Z</time>
  </wpt>
</gpx>
EOF
echo -e "${GREEN}✅ 测试 GPX 文件已创建: /tmp/test-location.gpx${NC}"

echo ""

# 步骤 4: 显示测试坐标
echo "📌 步骤 4/5: 显示测试坐标"
echo ""
echo "推荐测试坐标（在 Xcode: Features → Location → Custom Location… 中输入）："
echo ""
echo -e "${GREEN}北京地标：${NC}"
echo "  天安门:    39.9042, 116.4074"
echo "  故宫:      39.9163, 116.3971"
echo "  颐和园:    39.9998, 116.3279"
echo ""
echo -e "${GREEN}上海地标：${NC}"
echo "  东方明珠:  31.2397, 121.4990"
echo "  外滩:      31.2385, 121.4855"
echo ""
echo -e "${GREEN}深圳地标：${NC}"
echo "  市民中心:  22.5431, 114.0554"
echo "  莲花山:    22.5478, 114.0560"
echo ""

# 步骤 5: 提供测试指引
echo "📌 步骤 5/5: 自动化测试指引"
echo ""
echo "========================================"
echo "🧪 测试方法 A：固定位置测试"
echo "========================================"
echo ""
echo "1. 在 Xcode 菜单栏选择："
echo "   Features → Location → Custom Location…"
echo ""
echo "2. 输入任意测试坐标（例如：39.9042, 116.4074）"
echo ""
echo "3. 点击 OK"
echo ""
echo -e "${GREEN}预期结果：${NC}"
echo "  ✅ 地图自动跳转到北京天安门"
echo "  ✅ 缩放级别设置为 15"
echo "  ✅ 控制台显示位置更新日志"
echo ""
echo "========================================"
echo "🧪 测试方法 B：GPX 路线测试"
echo "========================================"
echo ""
echo "1. 在 Xcode 菜单栏选择："
echo "   Features → Location → Import GPX…"
echo ""
echo "2. 选择文件："
echo "   debug-tools/gpx-routes/beijing-city-tour.gpx"
echo ""
echo "3. 观察地图自动移动"
echo ""
echo -e "${GREEN}预期结果：${NC}"
echo "  ✅ 地图跟随 GPS 轨迹持续移动"
echo "  ✅ 每次位置更新都有动画效果"
echo "  ✅ 控制台显示位置更新日志"
echo ""
echo "========================================"
echo "🧪 测试方法 C：定位按钮测试"
echo "========================================"
echo ""
echo "1. 确保已授予位置权限"
echo ""
echo "2. 点击应用右侧工具栏的定位按钮（第 3 个按钮）"
echo ""
echo -e "${GREEN}预期结果：${NC}"
echo "  ✅ 地图跳转到当前 GPS 位置"
echo "  ✅ 控制台显示定位日志"
echo ""

# 生成测试报告
echo "========================================"
echo "📊 测试报告模板"
echo "========================================"
echo ""
cat > /tmp/gps-test-report.txt <<EOF
FunnyPixels GPS 功能测试报告
测试日期：$(date '+%Y-%m-%d %H:%M:%S')
测试人员：______________

---

## ✅ 基本功能测试

- [ ] 应用启动后自动请求位置权限
- [ ] 点击"允许使用时"后能获取位置
- [ ] 地图能自动跳转到模拟位置

## ✅ 固定位置测试（测试坐标：39.9042, 116.4074）

- [ ] 地图跳转到北京天安门
- [ ] 缩放级别为 15
- [ ] 跳转有动画效果
- [ ] 控制台显示位置日志

## ✅ GPX 路线测试（beijing-city-tour.gpx）

- [ ] 地图跟随 GPS 轨迹移动
- [ ] 移动过程流畅无卡顿
- [ ] 覆盖整个路线（西站 → 东单）
- [ ] 控制台显示位置更新日志

## ✅ 定位按钮测试

- [ ] 点击定位按钮后跳转
- [ ] 跳转到当前 GPS 位置
- [ ] 手动拖动地图后仍能正常工作

## ✅ 多城市切换测试

- [ ] 北京 → 上海 正常切换
- [ ] 上海 → 深圳 正常切换
- [ ] 深圳 → 广州 正常切换

---

## 📝 问题记录

位置 1：_______________
问题描述：_______________
解决方案：_______________

位置 2：_______________
问题描述：_______________
解决方案：_______________

---

## 🎯 总体评价

- [ ] 所有测试通过 ✅
- [ ] 部分测试通过 ⚠️
- [ ] 需要修复 ❌

评分（1-5 分）：___ 分

备注：
_____________________________________
_____________________________________
_____________________________________

EOF

echo "测试报告已生成: /tmp/gps-test-report.txt"
echo ""
echo "========================================"
echo -e "${GREEN}🎉 测试准备完成！${NC}"
echo "========================================"
echo ""
echo "下一步："
echo "1. 按照上述测试方法执行测试"
echo "2. 填写测试报告：open /tmp/gps-test-report.txt"
echo "3. 如有问题，查看详细指南：cat ../docs/gps/GPS_LOCATION_TESTING_GUIDE.md"
echo ""
