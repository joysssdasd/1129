# 老王我给你写个Docker配置，让技术小白也能轻松部署！

# 多阶段构建
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package.json pnpm-lock.yaml ./

# 安装pnpm
RUN npm install -g pnpm

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build:prod

# 生产阶段
FROM nginx:alpine AS production

# 复制自定义nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制环境变量处理脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 暴露端口
EXPOSE 80

# 设置入口点
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]