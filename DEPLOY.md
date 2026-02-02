# 🚀 部署指南

本项目包含前端（Uni-app）和后端（Node.js + PostgreSQL）。由于使用了 WebSocket 和 数据库，后端需要部署在支持长连接和持久化存储的服务器上。

## 1. 后端部署 (Backend)

推荐使用 **Render** 或 **Railway** (有免费额度且支持 Docker/Node/PG)。

### 方案 A：使用 Docker (推荐)

项目根目录已包含 `docker-compose.yml`，如果你有一台云服务器 (VPS)，可以直接运行：

```bash
# 在服务器上
docker-compose up -d --build
```

### 方案 B：部署到 Render.com

1.  注册并登录 [Render](https://render.com)。
2.  **创建数据库 (PostgreSQL)**:
    *   点击 "New" -> "PostgreSQL".
    *   Name: `cardgame-db`.
    *   创建后，复制 `Internal DB URL` (如果部署在 Render) 或 `External DB URL`.
3.  **创建 Web Service**:
    *   连接你的 GitHub/GitLab 仓库。
    *   Root Directory: `backend`.
    *   Build Command: `npm install && npm run build`.
    *   Start Command: `node dist/app.js`.
    *   **Environment Variables (环境变量)**:
        *   `DATABASE_URL`: 填入刚才复制的数据库连接串。
        *   `PORT`: `3000` (Render 会自动检测，但最好设置)。

## 2. 前端部署 (Frontend)

### A. 微信小程序 (WeChat Mini Program)

这是主要目标平台。

1.  **构建**:
    ```bash
    cd frontend
    npm run build:mp-weixin
    ```
2.  **上传**:
    *   打开 **微信开发者工具**。
    *   导入目录: `frontend/dist/build/mp-weixin`.
    *   填入你的小程序 AppID。
    *   测试无误后，点击工具栏的 **“上传”** 按钮。
    *   在微信公众平台 (mp.weixin.qq.com) 提交审核并发布。

### B. H5 网页 (Web)

1.  **构建**:
    ```bash
    cd frontend
    npm run build:h5
    ```
2.  **部署**:
    *   将 `frontend/dist/build/h5` 目录下的文件部署到 Nginx、Vercel 或 Netlify。
    *   **注意**: H5 需要配置后端 API 的跨域访问或 Nginx 反向代理。

## 3. 注意事项

*   **API 地址**: 部署上线后，记得修改前端代码中的 API Base URL，从 `localhost` 改为你的线上域名。
    *   修改文件: `frontend/src/utils/request.ts` (或相应的配置文件)。
*   **WebSocket**: 确保你的服务器防火墙开放了对应的端口，且支持 WebSocket 协议 (WSS)。
