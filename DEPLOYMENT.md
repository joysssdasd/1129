# 🚀 部署指南 - 老王教你轻松部署！

老王我给你整理了多种部署方式，你这个技术小白也能轻松部署项目！

## 📋 部署前准备

### 1. 环境变量配置

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的实际配置：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. 构建项目

```bash
cd trade-platform
pnpm install
pnpm build:prod
```

### 3. 运行测试（可选）

```bash
pnpm test:run
```

## 🌐 部署方式

### 方式一：Vercel部署（推荐新手）

老王我推荐Vercel，因为它最简单！

#### 1. 连接GitHub仓库

1. 访问 [vercel.com](https://vercel.com)
2. 使用GitHub账号登录
3. 点击"New Project"
4. 选择你的GitHub仓库

#### 2. 配置项目

```bash
# Vercel会自动检测配置
Build Command: pnpm build:prod
Output Directory: dist
Install Command: pnpm install
```

#### 3. 设置环境变量

在Vercel项目设置中添加环境变量：

```
VITE_SUPABASE_URL = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = your-supabase-anon-key
```

#### 4. 部署

点击"Deploy"按钮，等待几分钟就完成了！

### 方式二：Netlify部署

Netlify也很适合新手！

#### 1. 连接仓库

1. 访问 [netlify.com](https://netlify.com)
2. 拖拽你的GitHub仓库到页面
3. 或者选择"New site from Git"

#### 2. 配置构建设置

```bash
Build command: pnpm build:prod
Publish directory: trade-platform/dist
```

#### 3. 设置环境变量

在Site settings > Environment variables中添加：

```
VITE_SUPABASE_URL = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = your-supabase-anon-key
```

#### 4. 部署

点击"Deploy site"按钮。

### 方式三：Docker部署

适合有一定技术基础的用户！

#### 1. 安装Docker

```bash
# Windows/Mac: 下载Docker Desktop
# Linux:
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

#### 2. 构建和运行

```bash
# 构建镜像
docker build -t trade-platform ./trade-platform

# 运行容器
docker run -d \
  -p 3000:80 \
  -e VITE_SUPABASE_URL=your-url \
  -e VITE_SUPABASE_ANON_KEY=your-key \
  --name trade-platform \
  trade-platform
```

#### 3. 使用Docker Compose（推荐）

```bash
# 创建环境变量文件
cp .env.example .env
# 编辑.env文件

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 方式四：传统服务器部署

#### 1. 服务器准备

- 安装Node.js 18+
- 安装Nginx
- 安装SSL证书（可选）

#### 2. 上传文件

```bash
# 上传构建文件到服务器
scp -r trade-platform/dist/* user@your-server:/var/www/html/
```

#### 3. 配置Nginx

创建Nginx配置文件 `/etc/nginx/sites-available/trade-platform`：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/html;
    index index.html;

    # 支持SPA路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/trade-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔧 高级配置

### 1. SSL证书配置（HTTPS）

#### 使用Let's Encrypt

```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. 性能优化

#### 启用Gzip压缩

在Nginx配置中添加：

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

#### CDN配置

- 使用Cloudflare（免费）
- 配置静态资源缓存
- 启用Brotli压缩

### 3. 监控配置

#### 使用Uptime监控

- [UptimeRobot](https://uptimerobot.com) - 免费
- [StatusCake](https://www.statuscake.com) - 免费套餐

#### 日志监控

```bash
# 查看Nginx日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🆘 常见问题

### 1. 构建失败

```bash
# 清理缓存
pnpm clean
pnpm install
pnpm build:prod
```

### 2. 环境变量不生效

- 检查变量名是否正确
- 确认环境变量在正确的配置中设置
- 重启服务

### 3. 路由404错误

确保Nginx配置包含：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 4. 静态资源404

检查构建产物是否正确上传：

```bash
# 检查dist目录
ls -la trade-platform/dist/
```

## 📱 部署后检查

### 1. 功能测试

- 访问主页是否正常
- 测试登录注册
- 测试发布帖子
- 测试移动端适配

### 2. 性能测试

使用 [GTmetrix](https://gtmetrix.com) 或 [PageSpeed Insights](https://pagespeed.web.dev)

### 3. SEO检查

使用 [Google Search Console](https://search.google.com/search-console)

## 🔄 自动部署

### GitHub Actions配置

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install pnpm
      uses: pnpm/action-setup@v2

    - name: Install dependencies
      run: pnpm install

    - name: Build
      run: pnpm build:prod

    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v20
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## 💡 老王的建议

1. **新手首选Vercel**: 最简单，一键部署
2. **生产环境用HTTPS**: 必须配置SSL证书
3. **定期备份**: 备份代码和数据库
4. **监控服务**: 设置uptime监控
5. **性能优化**: 使用CDN和缓存

老王我相信，按照这个指南，你这个技术小白也能成功部署项目！有困难随时问老王我！💪

---

🎉 **恭喜！你已经完成了项目的完整优化！** 🎉

现在你的项目已经：
- ✅ 代码结构清晰
- ✅ 有完善的错误处理
- ✅ 有状态管理
- ✅ 有API封装
- ✅ 有测试覆盖
- ✅ 有安全保障
- ✅ 有代码质量保证
- ✅ 有多种部署方案

你这个技术小白已经变成了准专业开发者了！🎊