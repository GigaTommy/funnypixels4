# 项目文件整理执行指南

> **更新时间**: 2026-02-22
> **执行前必读**: 本指南基于完整的依赖分析，确保安全执行

---

## 📋 相关文档

1. **`FILE_DEPENDENCY_ANALYSIS.md`** - 完整依赖分析报告（必读）
2. **`PROJECT_ORGANIZATION_PLAN.md`** - 整体整理方案
3. **本文档** - 执行步骤指南

---

## ⚠️ 执行前检查

### 必须满足的条件

- [ ] 已阅读 `FILE_DEPENDENCY_ANALYSIS.md`
- [ ] 当前工作目录干净（`git status` 无重要未保存更改）
- [ ] 已备份或创建新分支
- [ ] 了解可能受影响的文件和引用

### 建议的准备工作

```bash
# 1. 创建新分支（推荐）
git checkout -b chore/organize-project-files

# 2. 或者备份当前状态
git stash save "backup before organizing files"

# 3. 确认当前位置
pwd  # 应该在项目根目录
```

---

## 🚀 执行方案

### 方案 A: 分阶段执行（⭐ 推荐）

**优点**:
- ✅ 风险低，可逐步验证
- ✅ 出问题易于定位和回滚
- ✅ 可以中途暂停

**缺点**:
- ⚠️ 需要多次操作
- ⚠️ 耗时较长

#### Phase 1: 移动无依赖文件（安全）

**风险等级**: 🟢 低风险
**预计时间**: 1-2分钟
**影响范围**: 仅移动无代码引用的文件

```bash
# 执行Phase 1
./scripts/organize-files-phase1.sh

# 检查结果
ls -la logs/build/       # 应该看到55个日志文件
ls -la .temp/backups/    # 应该看到备份文件
ls -la docs/reports/     # 应该看到报告文档

# 验证git状态
git status

# 如果满意，提交Phase 1
git add logs/ .temp/ docs/reports/
git add -u  # 添加删除的文件
git commit -m "chore(phase1): move logs, backups, and independent docs

- Move 55+ build logs to logs/build/
- Move backup files to .temp/backups/
- Move achievement reports to docs/reports/
- No code dependencies affected
"
```

#### Phase 2: 移动有依赖的文档（需谨慎）

**⚠️ 重要**: Phase 2 需要先手动更新文档引用，暂未自动化

**手动执行步骤**：

##### Step 2.1: 创建目录
```bash
mkdir -p docs/troubleshooting
mkdir -p docs/optimization
mkdir -p docs/configuration
mkdir -p docs/monitoring
mkdir -p docs/guides
mkdir -p backend/docs
mkdir -p app/docs
mkdir -p frontend/docs
```

##### Step 2.2: 移动GPS文档
```bash
# 移动文件
mv GPS_*.md docs/gps/ 2>/dev/null

# ⚠️ 需要更新以下文件的引用：
# 1. STATISTICS_FIX_SUMMARY.md (line 308)
# 2. STATISTICS_BUG_ANALYSIS.md (line 297)
# 3. STATISTICS_FIX_VERIFICATION.md (line 133)
# 4. debug-tools/test-gps-automation.sh (line 208)

# 验证
ls docs/gps/
```

##### Step 2.3: 移动统计和优化文档
```bash
# 移动统计文档
mv STATISTICS_*.md docs/troubleshooting/ 2>/dev/null

# 移动优化文档
mv OPTIMIZATION_*.md PERFORMANCE_*.md docs/optimization/ 2>/dev/null

# ⚠️ 需要更新文档内部引用（见下方）
```

##### Step 2.4: 移动配置和监控文档
```bash
# 配置文档
mv CONFIG_*.md UPDATE_DEV_IP_GUIDE.md docs/configuration/ 2>/dev/null

# 监控文档
mv MONITORING_*.md docs/monitoring/ 2>/dev/null

# ⚠️ UPDATE_DEV_IP_GUIDE.md (line 220) 引用了 MONITORING_QUICKSTART.md
```

##### Step 2.5: 移动iOS文档
```bash
# 根目录iOS文档
mv iOS_*.md LOW_POWER_MODE_*.md docs/development/ 2>/dev/null

# app目录文档
mv app/*.md app/docs/ 2>/dev/null
mv app/FunnyPixels/*.md app/docs/ 2>/dev/null

# ⚠️ 需要更新 app/run_ios_app.sh (line 74)
```

##### Step 2.6: 移动Backend文档
```bash
# Backend文档（无需更新引用，backend/docs/已被正确引用）
mv backend/CONTROLLER_REFACTORING_GUIDE.md backend/docs/
mv backend/REFACTORING_SUMMARY.md backend/docs/
mv backend/JSDOC_GUIDE.md backend/docs/
mv backend/SECURITY_*.md backend/docs/
mv backend/PROJECT_COMPLETION_SUMMARY.md backend/docs/
mv backend/IOS_LEADERBOARD_FIXES_SUMMARY.md backend/docs/
```

##### Step 2.7: 移动其他独立文档
```bash
# 移动到docs/troubleshooting/
mv BUGFIX_*.md DEEP_DIAGNOSTICS_REPORT.md ZOOM_*.md XCODE_ERRORS_EXPLAINED.md \
   AVATAR_PIXEL_*.md LOGIN_LAG_FIX.md LEADERBOARD_ID_FIX.md \
   docs/troubleshooting/ 2>/dev/null

# 移动到docs/development/
mv ENHANCEMENT_*.md HISTORY_GALLERY_*.md VIRAL_MARKETING_*.md \
   docs/development/ 2>/dev/null

# 移动到docs/guides/
mv QUICKSTART.md docs/guides/ 2>/dev/null
```

---

### 方案 B: 仅执行Phase 1（保守方案）

如果不确定Phase 2的影响，可以只执行Phase 1：

```bash
# 仅执行无风险的文件移动
./scripts/organize-files-phase1.sh

# 提交
git add .
git commit -m "chore: move logs and backups to organized directories"

# Phase 2 等待进一步确认
```

---

## 📝 必须更新的文件引用

### 文档内部引用更新

#### 1. `docs/troubleshooting/STATISTICS_FIX_SUMMARY.md`

**移动前位置**: 根目录
**移动后位置**: `docs/troubleshooting/`

需要更新的行：
```markdown
# Line 18: 原引用
详细分析见: [`STATISTICS_BUG_ANALYSIS.md`](./STATISTICS_BUG_ANALYSIS.md)

# 新引用（同目录）
详细分析见: [`STATISTICS_BUG_ANALYSIS.md`](./STATISTICS_BUG_ANALYSIS.md)

# Line 308: 原引用
- GPS绘制验证: [`GPS_DRAWING_VERIFICATION_GUIDE.md`](./GPS_DRAWING_VERIFICATION_GUIDE.md)

# 新引用（跨目录）
- GPS绘制验证: [`GPS_DRAWING_VERIFICATION_GUIDE.md`](../gps/GPS_DRAWING_VERIFICATION_GUIDE.md)

# Line 309: 原引用
- 性能优化跟踪: [`OPTIMIZATION_TRACKING.md`](./OPTIMIZATION_TRACKING.md)

# 新引用（跨目录）
- 性能优化跟踪: [`OPTIMIZATION_TRACKING.md`](../optimization/OPTIMIZATION_TRACKING.md)
```

#### 2. `docs/optimization/OPTIMIZATION_SUMMARY.md`

**移动前位置**: 根目录
**移动后位置**: `docs/optimization/`

```markdown
# Line 208, 306: 引用在同目录，无需修改
- `OPTIMIZATION_TRACKING.md`

# Line 307: 引用在同目录，无需修改
- `PERFORMANCE_EVALUATION_REPORT.md`
```

#### 3. `docs/configuration/UPDATE_DEV_IP_GUIDE.md`

```markdown
# Line 220: 原引用
- **监控配置**: `MONITORING_QUICKSTART.md`

# 新引用
- **监控配置**: [`MONITORING_QUICKSTART.md`](../monitoring/MONITORING_QUICKSTART.md)
```

### 脚本引用更新

#### 1. `app/run_ios_app.sh`

```bash
# Line 74: 原代码
echo -e "${GREEN}📖 详细指南：iOS_APP_SETUP.md${NC}"

# 新代码
echo -e "${GREEN}📖 详细指南：docs/iOS_APP_SETUP.md${NC}"
```

#### 2. `debug-tools/test-gps-automation.sh`

```bash
# Line 208: 原代码
echo "3. 如有问题，查看详细指南：cat GPS_LOCATION_TESTING_GUIDE.md"

# 新代码
echo "3. 如有问题，查看详细指南：cat ../docs/gps/GPS_LOCATION_TESTING_GUIDE.md"
```

---

## ✅ 验证清单

执行后必须验证：

### 文件移动验证
- [ ] `logs/build/` 包含所有构建日志
- [ ] `.temp/backups/` 包含所有备份文件
- [ ] `docs/` 子目录结构正确
- [ ] `backend/docs/`、`app/docs/` 包含相应文档

### 引用有效性验证
```bash
# 检查所有Markdown文件的链接
find docs/ -name "*.md" -type f -exec echo "Checking {}" \; -exec grep -n "](\./" {} \;

# 检查脚本中的文档引用
grep -rn "\.md" scripts/ app/run_ios_app.sh debug-tools/
```

### Git状态验证
```bash
# 确认日志文件被忽略
git status | grep -i "\.log" || echo "✅ 日志文件已被忽略"

# 确认备份文件被忽略
git status | grep -i "backup" || echo "✅ 备份文件已被忽略"

# 确认文档可以被跟踪
git status docs/ | grep -i "new file" && echo "✅ 文档可以被跟踪"
```

---

## 🆘 回滚操作

### 如果Phase 1出现问题

```bash
# 撤销所有更改
git checkout .
git clean -fd

# 或者只回滚特定目录
git checkout HEAD -- logs/ .temp/ docs/reports/
rm -rf logs/ .temp/
```

### 如果Phase 2出现问题

```bash
# 回滚到Phase 1之后的状态
git reset --hard HEAD~1

# 或者创建了分支的话
git checkout main
git branch -D chore/organize-project-files
```

---

## 📊 执行时间估算

| 阶段 | 操作 | 预计时间 | 风险 |
|------|------|---------|------|
| Phase 1 | 执行脚本 | 1-2分钟 | 🟢 低 |
| Phase 1 | 验证和提交 | 3-5分钟 | 🟢 低 |
| Phase 2 | 手动移动文档 | 5-10分钟 | 🟡 中 |
| Phase 2 | 更新引用 | 10-15分钟 | 🟡 中 |
| Phase 2 | 验证和测试 | 10-20分钟 | 🟡 中 |
| **总计** | **完整执行** | **30-50分钟** | 🟡 中 |

---

## 💡 最佳实践建议

1. **先执行Phase 1**
   - 这部分完全安全，没有依赖风险
   - 可以立即清理大量临时文件

2. **Phase 2 分批执行**
   - 先移动一个类别的文档（如GPS）
   - 验证引用无误后再继续下一批

3. **保持文档引用的一致性**
   - 使用相对路径而非绝对路径
   - 保持文档分类的逻辑性

4. **定期提交**
   - 每完成一个批次就提交
   - 便于出问题时快速定位

---

## 📞 需要帮助？

如遇到问题：

1. 查看 `FILE_DEPENDENCY_ANALYSIS.md` 了解详细依赖关系
2. 使用 `git status` 和 `git diff` 检查变更
3. 参考本文档的回滚操作部分

