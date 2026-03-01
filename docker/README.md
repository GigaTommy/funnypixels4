# Docker 配置 (Docker)

项目容器化配置和部署相关文件。

## 目录结构

```
docker/
├── frontend/                # 前端Docker配置
├── backend/                 # 后端Docker配置
├── database/                # 数据库Docker配置
├── queue/                   # 队列服务Docker配置
├── nginx/                   # Nginx反向代理配置
├── docker-compose.yml       # 开发环境编排
├── docker-compose.prod.yml  # 生产环境编排
└── README.md                # 说明文档
```

## 服务配置

### 前端服务 (frontend/)

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

### 后端服务 (backend/)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY node_modules ./node_modules

EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### 数据库服务 (database/)

```yaml
# docker-compose.yml
postgres:
  image: postgis/postgis:15-3.3
  environment:
    POSTGRES_DB: your_database_name
    POSTGRES_USER: your_database_user
    POSTGRES_PASSWORD: your_database_password
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./init.sql:/docker-entrypoint-initdb.d/init.sql
  ports:
    - "5432:5432"

redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes
  volumes:
    - redis_data:/data
  ports:
    - "6379:6379"
```

### 队列服务 (queue/)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY node_modules ./node_modules

EXPOSE 3002
CMD ["node", "dist/index.js"]
```

## 环境配置

### 开发环境 (docker-compose.yml)

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "5173:80"
    depends_on:
      - backend
    environment:
      - VITE_API_BASE_URL=http://localhost:3001
      - VITE_WS_URL=ws://localhost:3001

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://your_database_user:your_database_password@your_db_host:your_db_port/your_database_name
      - REDIS_URL=redis://redis:6379

  queue:
    build: ./queue
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379

  postgres:
    image: postgis/postgis:15-3.3
    environment:
      - POSTGRES_DB=your_database_name
      - POSTGRES_USER=your_database_user
      - POSTGRES_PASSWORD=your_database_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:
```

### 生产环境 (docker-compose.prod.yml)

```yaml
version: '3.8'

services:
  frontend:
    build: 
      context: ./frontend
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
    environment:
      - VITE_API_BASE_URL=https://api.pixelwar.com
      - VITE_WS_URL=wss://api.pixelwar.com

  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile.prod
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://pixelwar_user:pixelwar_password@postgres:5432/pixelwar
      - REDIS_URL=redis://redis:6379
    restart: unless-stopped

  queue:
    build: 
      context: ./queue
      dockerfile: Dockerfile.prod
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379
    restart: unless-stopped

  postgres:
    image: postgis/postgis:15-3.3
    environment:
      - POSTGRES_DB=pixelwar
      - POSTGRES_USER=pixelwar_user
      - POSTGRES_PASSWORD=pixelwar_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass redis_password
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## Nginx配置 (nginx/)

### 反向代理配置

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:80;
    }

    upstream backend {
        server backend:3001;
    }

    server {
        listen 80;
        server_name localhost;

        # 前端静态文件
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # API代理
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # WebSocket代理
        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
```

## 部署指南

### 开发环境部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 生产环境部署

```bash
# 构建生产镜像
docker-compose -f docker-compose.prod.yml build

# 启动生产服务
docker-compose -f docker-compose.prod.yml up -d

# 查看生产服务状态
docker-compose -f docker-compose.prod.yml ps
```

### 数据备份

```bash
# PostgreSQL备份
docker exec pixelwar_postgres_1 pg_dump -U pixelwar_user pixelwar > backup.sql

# Redis备份
docker exec pixelwar_redis_1 redis-cli BGSAVE
docker cp pixelwar_redis_1:/data/dump.rdb ./redis_backup.rdb
```

### 数据恢复

```bash
# PostgreSQL恢复
docker exec -i pixelwar_postgres_1 psql -U pixelwar_user pixelwar < backup.sql

# Redis恢复
docker cp redis_backup.rdb pixelwar_redis_1:/data/dump.rdb
docker exec pixelwar_redis_1 redis-cli BGREWRITEAOF
```

## 监控和日志

### 日志收集

```yaml
# 添加日志驱动
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 健康检查

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 安全配置

### 生产环境安全

1. **使用非root用户**
2. **设置资源限制**
3. **启用安全扫描**
4. **定期更新镜像**
5. **使用密钥管理**

```yaml
services:
  backend:
    user: "node"
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

