# FunnyPixels 项目文件整理方案

> **目标**：使项目文件组织符合 Monorepo 管理规范，提高可维护性和安全性

**整理日期**：2026-02-22
**整理原因**：根目录存在大量临时日志、MD文档和备份文件，需要分类整理

---

## 📊 当前问题分析

### 1. 文件数量统计
- **根目录MD文档**：46个
- **构建日志文件**：55个 (.log)
- **备份文件**：多个 (.backup*)
- **Backend文档**：8个MD文件
- **iOS App文档**：10+个MD文件

### 2. 主要问题
- ✗ 临时日志和文档混乱存放在根目录
- ✗ `.gitignore` 忽略了 `docs/` 和 `scripts/`（不应该忽略）
- ✗ 备份文件未被正确忽略
- ✗ 各子项目的文档缺少统一组织
- ✗ 可能存在敏感信息泄露风险

---

## 🎯 整理目标

### 1. 目录结构规范化
```
funnypixels3/
├── docs/                      # 项目级文档（已存在，需补充）
│   ├── architecture/          # 架构设计文档
│   ├── deployment/            # 部署文档
│   ├── development/           # 开发指南
│   ├── gps/                   # GPS相关文档
│   ├── optimization/          # 性能优化文档
│   ├── testing/               # 测试文档
│   ├── troubleshooting/       # 故障排查（新增）
│   ├── reports/               # 各种报告（新增）
│   ├── guides/                # 快速开始指南（新增）
│   ├── monitoring/            # 监控配置（新增）
│   └── configuration/         # 配置管理（新增）
│
├── logs/                      # 日志文件（新增）
│   ├── build/                 # 构建日志
│   └── runtime/               # 运行时日志
│
├── .temp/                     # 临时文件（新增）
│   └── backups/               # 备份文件
│
├── backend/
│   ├── docs/                  # 后端特定文档（新增）
│   ├── src/
│   └── ...
│
├── app/
│   ├── docs/                  # iOS特定文档（新增）
│   ├── FunnyPixels/
│   └── ...
│
├── frontend/
│   ├── docs/                  # 前端特定文档（新增）
│   └── ...
│
└── admin-frontend/
    ├── docs/                  # 管理后台文档（新增）
    └── ...
```

### 2. 文档分类方案

#### A. 根目录文档归档
| 文档类型 | 目标位置 | 示例 |
|---------|---------|------|
| 成就系统报告 | `docs/reports/` | `ACHIEVEMENT_*.md` |
| GPS相关文档 | `docs/gps/` | `GPS_*.md` |
| 性能优化 | `docs/optimization/` | `PERFORMANCE_*.md` |
| 配置管理 | `docs/configuration/` | `CONFIG_*.md` |
| 监控文档 | `docs/monitoring/` | `MONITORING_*.md` |
| 故障排查 | `docs/troubleshooting/` | `BUGFIX_*.md` |
| 开发指南 | `docs/development/` | `iOS_*.md` |
| 快速开始 | `docs/guides/` | `QUICKSTART.md` |

#### B. 子项目文档归档
| 源位置 | 目标位置 | 说明 |
|--------|---------|------|
| `backend/*.md` | `backend/docs/` | 后端重构、安全、JSDoc文档 |
| `app/FunnyPixels/*.md` | `app/docs/` | iOS开发进度、实现报告 |
| `app/*.md` | `app/docs/` | iOS设置、调试指南 |

#### C. 日志和临时文件
| 文件类型 | 目标位置 | 说明 |
|---------|---------|------|
| `build_v*.log` | `logs/build/` | 构建日志 |
| `*.backup*` | `.temp/backups/` | 备份文件 |
| `.zeroclaw/*.log` | `logs/runtime/` | 运行时日志 |
| 临时脚本 | `.temp/` | `remove_bg.*`等 |

---

## 🔧 执行步骤

### Step 1: 备份当前状态（推荐）
```bash
# 创建整个项目的备份（可选）
tar -czf ~/funnypixels3-backup-$(date +%Y%m%d).tar.gz .git
```

### Step 2: 执行文件整理
```bash
# 赋予执行权限
chmod +x scripts/organize-project-files.sh
chmod +x scripts/update-gitignore.sh

# 执行整理脚本
./scripts/organize-project-files.sh
```

**预期结果**：
- 55个日志文件 → `logs/build/`
- 46个MD文档 → `docs/*/` 或 `*/docs/`
- 备份文件 → `.temp/backups/`
- 临时文件 → `.temp/`

### Step 3: 更新.gitignore
```bash
# 执行更新脚本
./scripts/update-gitignore.sh
```

**主要变更**：
- ✓ 添加 `logs/` 到忽略列表
- ✓ 添加 `.temp/` 到忽略列表
- ✓ 移除 `docs/` 的忽略（文档应该被跟踪）
- ✓ 移除 `scripts/` 的忽略（脚本应该被跟踪）
- ✓ 优化备份文件的忽略规则

### Step 4: 验证整理结果
```bash
# 查看文件变更
git status

# 检查未跟踪的文件（应该只有新创建的目录和文档）
git status --porcelain | grep "^??"

# 检查忽略规则是否生效
git check-ignore -v logs/build/build_v1.log
# 应该输出：.gitignore:129:logs/  logs/build/build_v1.log
```

### Step 5: 提交更改
```bash
# 添加所有变更
git add .

# 提交
git commit -m "chore: organize project files to follow monorepo standards

- Move 55 build logs to logs/build/
- Organize 46 MD documents into docs/ subdirectories
- Create backend/docs/, app/docs/, frontend/docs/ for module-specific docs
- Move backup files to .temp/backups/
- Update .gitignore to track docs/ and scripts/
- Add logs/ and .temp/ to .gitignore
- Improve security by excluding sensitive files
"
```

---

## 🔒 安全性改进

### 1. .gitignore 优化
**已添加到忽略列表**：
- `logs/` - 防止日志文件进入仓库
- `.temp/` - 临时文件不应被跟踪
- `*.backup*` - 备份文件可能包含敏感信息
- `*.log` - 所有日志文件
- `.env*` (已存在) - 环境变量配置

### 2. 敏感文件检查清单
- [x] `.env` 文件已被忽略
- [x] `.env.backup.*` 文件已移到 `.temp/`
- [x] `*.log` 文件已移到 `logs/` 并被忽略
- [x] `Info.plist.backup.*` 已移到 `.temp/`
- [x] 数据库备份文件规则已优化

### 3. 建议的安全措施
```bash
# 检查是否有敏感文件被意外跟踪
git ls-files | grep -E "\\.env$|backup|secret|password|key"

# 如果发现敏感文件已被提交，需要从历史中移除
# git filter-branch --index-filter 'git rm --cached --ignore-unmatch path/to/sensitive/file' HEAD
```

---

## 📝 维护建议

### 1. 日常开发规范
- ✓ 新的构建日志应自动输出到 `logs/build/`
- ✓ 文档应放在对应的 `docs/` 子目录
- ✓ 临时文件使用 `.temp/` 目录
- ✓ 定期清理 `logs/` 目录（保留最近30天）

### 2. 文档管理规范
```bash
# 项目级文档
docs/
  ├── guides/           # 用户指南、快速开始
  ├── architecture/     # 架构设计、技术选型
  ├── development/      # 开发规范、代码风格
  └── reports/          # 分析报告、总结文档

# 模块级文档
backend/docs/          # 后端API文档、架构说明
app/docs/              # iOS开发文档、实现细节
frontend/docs/         # 前端组件文档、状态管理
```

### 3. .gitignore 定期审查
- 每月检查 `.gitignore` 是否需要更新
- 新增第三方工具时，添加对应的忽略规则
- 确保敏感信息不会被意外提交

---

## ✅ 验收标准

整理完成后，应满足以下条件：

- [ ] 根目录不再有 `.log` 文件
- [ ] 根目录MD文档数量 < 5个（只保留README.md等核心文档）
- [ ] `docs/` 目录结构清晰，文档分类合理
- [ ] `backend/docs/`、`app/docs/` 包含模块特定文档
- [ ] `logs/` 和 `.temp/` 被 `.gitignore` 忽略
- [ ] `git status` 不显示日志和备份文件
- [ ] 所有重要文档能被git跟踪
- [ ] 敏感配置文件被正确忽略

---

## 🆘 回滚方案

如果整理过程出现问题：

```bash
# 方案1: 使用git恢复
git checkout .
git clean -fd

# 方案2: 恢复.gitignore备份
cp .gitignore.backup.YYYYMMDD_HHMMSS .gitignore

# 方案3: 使用完整备份（如果创建了）
cd ~/
tar -xzf funnypixels3-backup-YYYYMMDD.tar.gz
```

---

## 📞 后续支持

如有问题，请参考：
- 项目README: `/README.md`
- 快速开始: `/docs/guides/QUICKSTART.md`
- 故障排查: `/docs/troubleshooting/`

**整理工具位置**：
- `/scripts/organize-project-files.sh`
- `/scripts/update-gitignore.sh`
