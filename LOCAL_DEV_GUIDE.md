# 老王的本地开发环境搭建指南

## 🎯 简介

技术小白也能轻松搭建本地开发环境！老王我给你准备了一套完整的开发环境配置，包含前端应用、数据库、缓存等所有必需的服务。

## 📋 环境要求

### 必需软件
- **Docker Desktop** - 容器化平台（必装）
- **Git** - 版本控制工具
- **Node.js 18+** - 如果你需要在本地运行前端

### 可选软件
- **VS Code** - 代码编辑器（推荐）
- **Postman** - API测试工具
- **DBeaver** - 数据库管理工具

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目（如果还没有）
git clone <your-repo-url>
cd <project-dir>

# 复制环境变量文件
cp .env.example .env.local
```

### 2. 一键启动

**Windows用户：**
```bash
start-local.bat
```

**Mac/Linux用户：**
```bash
chmod +x start-local.sh
./start-local.sh
```

### 3. 选择启动模式

启动脚本会提供以下选项：
- `1` - 完整环境（推荐）
- `2` - 仅数据库和Redis
- `3` - 仅前端应用
- `4` - 开发工具（管理界面）
- `5` - 停止所有服务
- `6` - 重启所有服务

## 🌐 服务访问地址

启动成功后，可以通过以下地址访问各个服务：

| 服务 | 地址 | 说明 |
|------|------|------|
| **前端应用** | http://localhost:5173 | React开发服务器 |
| **数据库管理** | http://localhost:8080 | Adminer（需启动tools） |
| **Redis管理** | http://localhost:8081 | Redis Commander（需启动tools） |
| **PostgreSQL** | localhost:5432 | 数据库连接 |
| **Redis** | localhost:6379 | 缓存连接 |

## 📊 数据库连接信息

```
服务器: localhost:5432
数据库: trade_platform_local
用户名: postgres
密码: local_password_123
```

## 🔧 常用操作

### 查看服务状态
```bash
docker-compose -f docker-compose.local.yml ps
```

### 查看服务日志
```bash
# 查看所有服务日志
docker-compose -f docker-compose.local.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose.local.yml logs -f frontend-dev
docker-compose -f docker-compose.local.yml logs -f postgres-dev
```

### 进入容器
```bash
# 进入前端容器
docker exec -it trade-platform-frontend-dev bash

# 进入数据库容器
docker exec -it trade-platform-postgres-dev bash
```

### 数据库操作
```bash
# 备份数据库
./scripts/backup-db.sh  # Mac/Linux
scripts\backup-db.bat   # Windows

# 恢复数据库
./scripts/restore-db.sh  # Mac/Linux
scripts\restore-db.bat   # Windows
```

### 重启服务
```bash
# 重启所有服务
./start-local.sh  # 选择 6

# 重启特定服务
docker-compose -f docker-compose.local.yml restart frontend-dev
```

### 停止服务
```bash
# 停止所有服务
docker-compose -f docker-compose.local.yml down

# 停止并删除数据卷（慎用！）
docker-compose -f docker-compose.local.yml down -v
```

## 🛠️ 开发工作流

### 1. 日常开发
```bash
# 启动开发环境
./start-local.sh  # 选择 1

# 查看前端日志，确保正常运行
docker-compose -f docker-compose.local.yml logs -f frontend-dev

# 开始编码...
```

### 2. 测试功能
- 访问 http://localhost:5173 测试前端功能
- 使用浏览器开发者工具调试
- 检查控制台是否有错误信息

### 3. 数据库调试
```bash
# 启动数据库管理工具
./start-local.sh  # 选择 4

# 访问 http://localhost:8080
# 使用之前提到的数据库连接信息登录
```

### 4. 代码提交
```bash
# 如果配置了自动提交服务
npm start  # 启动自动提交监控

# 或者手动提交
git add .
git commit -m "你的提交信息"
git push
```

## 🔍 故障排查

### 常见问题

#### 1. 端口冲突
如果遇到端口被占用的错误：
```bash
# 查看端口占用
netstat -ano | findstr :5173  # Windows
lsof -i :5173                # Mac/Linux

# 停止占用进程或修改端口
```

#### 2. Docker服务无法启动
```bash
# 重启Docker Desktop
# 检查Docker服务状态
docker version
docker-compose version
```

#### 3. 数据库连接失败
```bash
# 检查数据库容器状态
docker ps | grep postgres

# 查看数据库日志
docker-compose -f docker-compose.local.yml logs postgres-dev

# 重启数据库容器
docker-compose -f docker-compose.local.yml restart postgres-dev
```

#### 4. 前端编译错误
```bash
# 查看前端容器日志
docker-compose -f docker-compose.local.yml logs frontend-dev

# 重新构建前端镜像
docker-compose -f docker-compose.local.yml build --no-cache frontend-dev

# 清理node_modules并重新安装
docker exec -it trade-platform-frontend-dev sh
rm -rf node_modules
pnpm install
```

#### 5. 权限问题（Linux/Mac）
```bash
# 给脚本执行权限
chmod +x start-local.sh
chmod +x scripts/*.sh
```

### 获取帮助
如果遇到无法解决的问题：
1. 查看相关服务的日志文件
2. 检查Docker和Docker Compose版本
3. 确保端口没有被其他程序占用
4. 重启Docker Desktop

## 📁 项目结构

```
E:\claude15\
├── .env.local              # 本地环境变量配置
├── .env.example            # 环境变量示例
├── docker-compose.local.yml # 本地开发Docker配置
├── redis.conf              # Redis配置文件
├── init-db.sql             # 数据库初始化脚本
├── start-local.sh          # 启动脚本（Mac/Linux）
├── start-local.bat         # 启动脚本（Windows）
├── auto-commit.js          # 自动提交服务
├── trade-platform/         # 前端项目目录
│   ├── src/                # 源代码
│   ├── package.json        # 依赖配置
│   ├── vite.config.ts      # Vite配置
│   └── ...                 # 其他前端文件
├── scripts/                # 工具脚本
│   ├── backup-db.sh        # 数据库备份脚本
│   ├── backup-db.bat       # 数据库备份脚本（Windows）
│   ├── restore-db.sh       # 数据库恢复脚本
│   └── restore-db.bat      # 数据库恢复脚本（Windows）
└── backups/                # 数据库备份目录
```

## 💡 开发技巧

### 1. 热重载
前端代码修改后会自动重新加载，无需手动重启。

### 2. 数据库重置
如果需要重置数据库：
```bash
# 停止服务
docker-compose -f docker-compose.local.yml down

# 删除数据库卷
docker volume rm claude15_postgres_dev_data

# 重新启动
./start-local.sh  # 选择 1
```

### 3. 性能监控
```bash
# 查看容器资源使用情况
docker stats

# 查看磁盘使用情况
docker system df
```

### 4. 日志管理
```bash
# 清理所有日志
docker system prune -f

# 限制日志文件大小
# 在docker-compose.local.yml中添加logging配置
```

## 🎉 结语

这套本地开发环境配置帮你搞定了一切复杂的设置，让你能专注于代码开发！有任何问题都可以参考这个指南。

**💻 老王祝你开发愉快！有问题就骂！**