# 项目目录清理分析报告

生成日期：2026-03-02

## 项目当前架构

### 核心模块（必须保留）
- `FunnyPixelsApp/` - 当前 iOS 应用（主要）
- `backend/` - 后端 Node.js 服务（主要）
- `frontend/` - Web 前端 React 应用（主要）
- `admin-frontend/` - 管理后台 React 应用（主要）
- `docs/` - 项目文档
- `scripts/` - 项目脚本
- `deploy/` - 生产部署脚本和配置

## 目录分类分析

### ❌ 明确应删除的目录

#### 1. `app/` (旧 iOS 应用)
- **大小**: 包含 .build 等构建产物
- **原因**: 已被 `FunnyPixelsApp/` 完全替代
- **建议**: 删除

#### 2. `archive/` (归档文件)
- **内容**: md 文档归档
- **原因**: 归档文件不应在 git 中
- **建议**: 删除（或移到 git 之外）

#### 3. `backup/` (备份文件)
- **内容**: amap-files 备份
- **原因**: 备份文件不应在 git 中
- **建议**: 删除

#### 4. `data/` (数据文件)
- **内容**: geolocation 数据
- **原因**: 数据文件不应在 git 中
- **建议**: 删除

#### 5. `database/seeds/` (大型备份 SQL)
- **大小**: 445MB+ 的 SQL 备份文件
- **原因**:
  - 后端已有独立的 seeds 目录: `backend/src/database/seeds/`
  - 大型 SQL 文件不应在 git 中
- **建议**: 删除（已在 .gitignore 中）

#### 6. `ios-stress-test/` (旧压力测试)
- **内容**: .build 构建产物
- **原因**: 已有新的 stress-test skills 替代
- **建议**: 删除

### ⚠️ 监控相关（可选删除）

#### 7. `alertmanager/` (Alertmanager 配置)
- **用途**: docker-compose.monitoring.yml 使用
- **原因**: 本地开发通常不需要监控
- **建议**:
  - 如果不使用监控：删除
  - 如果使用生产监控：保留但移到 deploy/ 下

#### 8. `grafana/` (Grafana 配置)
- **用途**: docker-compose.monitoring.yml 使用
- **建议**: 同 alertmanager

#### 9. `prometheus/` (Prometheus 配置)
- **用途**: docker-compose.monitoring.yml 使用
- **建议**: 同 alertmanager

#### 10. `ops/` (运维工具)
- **内容**: autoscale 等
- **建议**: 如果有生产部署需求保留，否则删除

### 🤔 需要确认的目录

#### 11. `config/` (配置文件)
- **内容**: pgadmin-servers.json
- **原因**: 可能已整合到各项目中
- **建议**: 检查是否还在使用，否则删除

#### 12. `debug-tools/` (调试工具)
- **内容**: gpx-routes, QUICK_REFERENCE.md
- **建议**: 如果 iOS 开发需要 GPX 路线，保留；否则删除

#### 13. `docker/` (Docker 文档)
- **内容**: README.md
- **建议**: 内容可能已过时，删除或整合到 docs/

#### 14. `fastlane/` (iOS 自动化部署)
- **内容**: Deliverfile, metadata
- **建议**:
  - 如果使用 App Store 自动化部署：保留
  - 否则删除

#### 15. `infrastructure/` (基础设施)
- **内容**: nginx 配置
- **原因**: nginx 配置已在 deploy/ 和根目录 nginx/ 中
- **建议**: 删除（重复）

#### 16. `nginx/` (Nginx 配置)
- **内容**: nginx.conf
- **原因**: deploy/ 中已有 nginx.conf
- **建议**: 检查是否重复，可能删除

#### 17. `public/` (公共文件)
- **内容**: emoji-atlas-generator HTML 文件
- **建议**: 如果工具还在使用保留，否则删除

#### 18. `queue/` (队列文档)
- **内容**: README.md
- **建议**: 如果内容已过时或整合，删除

#### 19. `shared/` (共享代码)
- **内容**: config, constants, types, utils
- **原因**: 未在任何 package.json 中引用
- **建议**: 检查是否实际使用，否则删除

## 估算影响

### 确定删除的目录
```
app/              ~100MB (包含 .build)
archive/          ~数 MB
backup/           ~数 MB
data/             ~数 MB
database/seeds/   ~450MB (SQL 备份已在 .gitignore)
ios-stress-test/  ~数十 MB (包含 .build)
```

**预计可释放**: 500MB+ (不含已在 .gitignore 的文件)

### 监控相关目录（可选）
```
alertmanager/     ~10KB
grafana/          ~100KB
prometheus/       ~50KB
ops/              ~100KB
```

**预计可释放**: ~1MB

### 待确认目录
```
config/           ~10KB
debug-tools/      ~数 MB
docker/           ~10KB
fastlane/         ~100KB
infrastructure/   ~10KB
nginx/            ~10KB
public/           ~100KB
queue/            ~10KB
shared/           ~100KB
```

**预计可释放**: ~5MB

## 建议清理顺序

### 第一阶段：删除明确不需要的大目录
1. `app/` (旧 iOS 应用)
2. `ios-stress-test/` (旧压力测试)
3. `archive/` (归档)
4. `backup/` (备份)
5. `data/` (数据)

### 第二阶段：删除监控相关（如果不使用）
6. `alertmanager/`
7. `grafana/`
8. `prometheus/`
9. `ops/`

### 第三阶段：清理小目录
10. `infrastructure/` (重复)
11. `docker/` (文档)
12. `queue/` (文档)
13. 其他待确认的目录

## 执行命令示例

```bash
# 第一阶段
git rm -r app archive backup data ios-stress-test

# 第二阶段（如果确认不使用监控）
git rm -r alertmanager grafana prometheus ops

# 第三阶段
git rm -r infrastructure docker queue

# 更新 .gitignore
# (添加 data/, backup/ 等)

# 提交
git commit -m "chore: Remove unused directories to reduce repository size"
git push origin main
```

## 注意事项

1. 在删除前，建议先备份整个项目
2. 删除后需要测试构建和部署流程
3. 某些目录可能在文档中被引用，需要更新文档
4. 如果有团队成员，需要通知他们这些更改
