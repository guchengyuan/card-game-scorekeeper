# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist
# 云托管中通过环境变量配置，不要复制 .env 文件
# COPY --from=builder /app/.env ./.env

EXPOSE 80

CMD ["node", "dist/app.js"]
