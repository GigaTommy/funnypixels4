# 生产环境PostGIS安装指南

## 为什么需要PostGIS？

当前地理归属API失败的原因是缺少PostGIS扩展：
- 代码使用了 `ST_Contains`, `ST_Point`, `ST_SetSRID` 等PostGIS空间函数
- 没有PostGIS，这些函数无法执行，导致API返回HTML错误页面
- 需要PostGIS来进行精确的地理空间查询和像素位置匹配

## 安装步骤

### 方案1: 使用自动化脚本（推荐）

1. **运行安装脚本**:
   ```bash
   cd backend
   node scripts/install-postgis.js
   ```

2. **如果权限不足**，会提示需要超级用户权限

### 方案2: 手动安装

1. **连接到生产数据库**（需要超级用户权限）:
   ```bash
   psql -h <host> -U <superuser> -d <database>
   ```

2. **执行安装命令**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

3. **验证安装**:
   ```sql
   SELECT PostGIS_Version();
   ```

### 方案3: 使用SQL脚本

1. **使用提供的SQL脚本**:
   ```bash
   psql -h <host> -U <superuser> -d <database> -f scripts/install-postgis-production.sql
   ```

## 验证安装

安装完成后，运行验证脚本：
```bash
node scripts/check-geographic-tables.js
```

应该看到：
```
PostGIS已安装: true
PostGIS版本: 3.x.x
```

## 可能的问题和解决方案

### 1. 权限不足错误
```
ERROR: permission denied to create extension "postgis"
```

**解决方案**:
- 使用PostgreSQL超级用户（通常是 `postgres`）
- 或者请数据库管理员协助安装

### 2. PostGIS包未安装
```
ERROR: extension "postgis" is not available
```

**解决方案**:
在服务器上安装PostGIS包：

- **Ubuntu/Debian**:
  ```bash
  sudo apt-get update
  sudo apt-get install postgresql-contrib postgresql-<version>-postgis-3
  ```

- **CentOS/RHEL**:
  ```bash
  sudo yum install postgis33_<version>
  ```

- **Docker**:
  使用带PostGIS的PostgreSQL镜像：
  ```bash
  docker run -d postgis/postgis:14-3.2
  ```

### 3. 云数据库服务

#### AWS RDS
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

#### Google Cloud SQL
PostGIS通常已经可用，直接启用：
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

#### Azure Database for PostgreSQL
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## 安装后的效果

PostGIS安装成功后：

1. **地理归属API将正常工作**:
   - `GET /api/geographic/pixel/:gridId/location` 返回JSON而不是HTML错误
   - 像素绘制时能正确获取地理位置信息

2. **空间查询功能可用**:
   - 精确的点在多边形内查询
   - 地理边界匹配
   - 坐标系转换

3. **相关功能恢复**:
   - 地理排行榜
   - 区域统计
   - 位置缓存

## 验证命令

安装后运行以下命令验证：

```bash
# 检查PostGIS
node scripts/install-postgis.js

# 检查地理表
node scripts/check-geographic-tables.js

# 测试地理API（如果有测试数据）
curl -X GET "http://localhost:3000/api/geographic/pixel/123/location?latitude=39.9042&longitude=116.4074"
```

## 注意事项

1. **备份数据库**: 安装扩展前建议备份
2. **权限要求**: 需要PostgreSQL超级用户权限
3. **版本兼容**: 确保PostGIS版本与PostgreSQL版本兼容
4. **性能考虑**: PostGIS安装后数据库体积会增加（约30MB）

## 相关文件

- `scripts/install-postgis.js` - 自动安装脚本
- `scripts/install-postgis-production.sql` - SQL安装脚本
- `scripts/check-geographic-tables.js` - 验证脚本
- `src/services/pixelLocationService.js` - 使用PostGIS的服务