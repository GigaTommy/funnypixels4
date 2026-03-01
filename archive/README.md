# 归档目录 (Archive)

本目录存放从项目根目录归档的文档、脚本和测试文件，以保持项目根目录简洁。

归档时间：2026-02-28

## 目录结构

### md/
根目录下的实现总结、修复文档等 Markdown 文件（`README.md` 保留在根目录）：

- 后端修复/优化总结
- 国际化 (I18N) 实现文档
- Live Activity 相关文档
- iOS 启动优化文档
- 功能实现总结等

### scripts/
根目录下的一次性/辅助脚本（以下常用脚本保留在根目录）：
- `sync-config.js` / `sync-config.sh` - 配置同步（`npm run sync-config`）
- `update-dev-ip.sh` / `update-dev-ip.ps1` - 开发环境 IP 更新
- `start-all.sh` / `stop-all.sh` - 服务启停
- `docker-services.sh` - Docker 服务管理

已归档脚本：
- `enable-optimized-live-activity.sh` - Live Activity 优化开关
- `fix-spm.sh` - SPM 修复
- `setup_viral_marketing.sh` - 病毒式营销功能初始化
- `update-logo-to-real.sh` - Logo 更新

### scripts-tests/
从 `scripts/` 目录归档的测试相关文件：

- **test/** - 测试脚本目录（像素绘制、Geocoding、诊断等）
- **运行脚本**：`run-gps-test.sh`, `run-ws-test.sh`, `run-tile-test.bat` 等
- **测试 JS**：`quick-gps-test.js`, `ws-room-test.js`, `concurrency-test.js` 等
- **demo.js** - GPS 绘制模拟演示

使用方式：进入 `archive/scripts-tests/` 后运行相应脚本。

## 引用说明

- `scripts/package.json` 的 `test` 命令已更新为 `archive/scripts-tests/quick-gps-test.js`
- 音效测试：`scripts/implement-sounds.sh` 会调用 `archive/scripts-tests/test-sounds.sh`（若需单独运行，请使用完整路径）
