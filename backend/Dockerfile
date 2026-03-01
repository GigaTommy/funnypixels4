# 使用标准的 Node.js 18 镜像 (基于 Debian)
FROM node:18

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
# 在生产构建中，只安装生产依赖
RUN npm ci --omit=dev

# 复制源代码（包括shared目录和database目录）
COPY . .

# 确保database/seeds目录存在
RUN mkdir -p database/seeds

# 设置环境变量默认值
ENV NODE_ENV production
ENV PORT 3001

# 暴露端口
EXPOSE 3001

# 启动应用
# 注意：数据库迁移应在部署流程中单独运行 (Cloud Build 或 Cloud Run Job)，而不是在容器启动时运行
# 这样可以加快冷启动速度，避免多实例并发迁移的问题
CMD ["node", "src/server.js"]