#!/bin/bash

# 老王我给你写个本地开发启动脚本！一键启动整个开发环境！

set -e  # 出错就停止

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 显示Logo
echo -e "${PURPLE}"
echo "╔═══════════════════════════════════════╗"
echo "║     老王本地开发环境启动器              ║"
echo "║     技术小白也能轻松搞定！              ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# 检查环境
echo -e "${BLUE}🔍 检查环境...${NC}"

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装！请先安装Docker Desktop${NC}"
    exit 1
fi

# 检查Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装！请先安装Docker Compose${NC}"
    exit 1
fi

# 检查环境变量文件
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  未找到.env.local文件，使用默认配置${NC}"
    cp .env.example .env.local
fi

# 加载环境变量
source .env.local

echo -e "${GREEN}✅ 环境检查完成${NC}"

# 显示服务信息
echo -e "${BLUE}📋 服务信息：${NC}"
echo "   • 前端应用: http://localhost:5173"
echo "   • 数据库管理: http://localhost:8080 (需要启动tools)"
echo "   • Redis管理: http://localhost:8081 (需要启动tools)"
echo "   • 数据库: localhost:5432"
echo "   • Redis: localhost:6379"

# 选择启动模式
echo ""
echo -e "${YELLOW}请选择启动模式：${NC}"
echo "1) 完整环境 (前端 + 数据库 + Redis)"
echo "2) 仅数据库和Redis (后端服务)"
echo "3) 仅前端 (需要外部数据库)"
echo "4) 开发工具 (数据库管理界面)"
echo "5) 停止所有服务"
echo "6) 重启所有服务"

read -p "请输入选择 (1-6): " choice

case $choice in
    1)
        echo -e "${BLUE}🚀 启动完整开发环境...${NC}"
        docker-compose -f docker-compose.local.yml up -d
        echo -e "${GREEN}✅ 完整环境启动成功！${NC}"
        ;;
    2)
        echo -e "${BLUE}🚀 启动数据库和Redis...${NC}"
        docker-compose -f docker-compose.local.yml up -d postgres-dev redis-dev
        echo -e "${GREEN}✅ 数据库和Redis启动成功！${NC}"
        ;;
    3)
        echo -e "${BLUE}🚀 启动前端应用...${NC}"
        docker-compose -f docker-compose.local.yml up -d frontend-dev
        echo -e "${GREEN}✅ 前端应用启动成功！${NC}"
        ;;
    4)
        echo -e "${BLUE}🚀 启动开发工具...${NC}"
        docker-compose -f docker-compose.local.yml --profile tools up -d adminer redis-commander
        echo -e "${GREEN}✅ 开发工具启动成功！${NC}"
        ;;
    5)
        echo -e "${YELLOW}🛑 停止所有服务...${NC}"
        docker-compose -f docker-compose.local.yml down
        echo -e "${GREEN}✅ 所有服务已停止${NC}"
        exit 0
        ;;
    6)
        echo -e "${YELLOW}🔄 重启所有服务...${NC}"
        docker-compose -f docker-compose.local.yml down
        sleep 2
        docker-compose -f docker-compose.local.yml up -d
        echo -e "${GREEN}✅ 所有服务重启完成！${NC}"
        ;;
    *)
        echo -e "${RED}❌ 无效选择！${NC}"
        exit 1
        ;;
esac

# 等待服务启动
echo ""
echo -e "${BLUE}⏳ 等待服务启动...${NC}"
sleep 5

# 检查服务状态
echo -e "${BLUE}📊 服务状态：${NC}"
docker-compose -f docker-compose.local.yml ps

# 显示访问链接
echo ""
echo -e "${GREEN}🎉 开发环境启动完成！${NC}"
echo ""
echo -e "${BLUE}🔗 访问链接：${NC}"
echo "   • 前端应用: ${GREEN}http://localhost:5173${NC}"
echo "   • API文档: ${GREEN}http://localhost:5173/api-docs${NC}"

# 检查是否启动了管理工具
if docker ps | grep -q "trade-platform-adminer"; then
    echo "   • 数据库管理: ${GREEN}http://localhost:8080${NC}"
    echo "       - 服务器: postgres-dev"
    echo "       - 用户名: ${POSTGRES_USER:-postgres}"
    echo "       - 密码: ${POSTGRES_PASSWORD:-local_password_123}"
    echo "       - 数据库: ${POSTGRES_DB:-trade_platform_local}"
fi

if docker ps | grep -q "trade-platform-redis-commander"; then
    echo "   • Redis管理: ${GREEN}http://localhost:8081${NC}"
fi

echo ""
echo -e "${BLUE}📝 有用的命令：${NC}"
echo "   • 查看日志: docker-compose -f docker-compose.local.yml logs -f [服务名]"
echo "   • 进入容器: docker exec -it [容器名] bash"
echo "   • 备份数据库: ./scripts/backup-db.sh"
echo "   • 恢复数据库: ./scripts/restore-db.sh"
echo "   • 停止服务: ./start-local.sh 选择 5"
echo ""
echo -e "${PURPLE}💻 老王祝你开发愉快！${NC}"