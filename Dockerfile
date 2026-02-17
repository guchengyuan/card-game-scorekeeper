# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 backend 下的依赖文件到根目录
COPY backend/package*.json ./
RUN npm install

# 复制 backend 下的所有文件到根目录
COPY backend/ .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# 复制 backend 下的依赖文件到根目录
COPY backend/package*.json ./
RUN npm install --production

# 从 builder 阶段复制 dist 目录
COPY --from=builder /app/dist ./dist

# 云托管中通过环境变量配置，不要复制 .env 文件
# COPY --from=builder /app/.env ./.env

EXPOSE 80

CMD ["node", "dist/app.js"]