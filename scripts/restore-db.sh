#!/bin/bash

# 老王我给你写个数据库恢复脚本！一键恢复备份！

# 配置
CONTAINER_NAME="trade-platform-postgres-dev"
DB_NAME="trade_platform_local"
DB_USER="postgres"
BACKUP_DIR="./backups"

# 显示可用备份文件
echo "📋 可用的备份文件："
ls -la $BACKUP_DIR/backup_*.sql 2>/dev/null | awk '{print $9}' | nl

if [ $? -ne 0 ]; then
    echo "❌ 没有找到备份文件！"
    exit 1
fi

echo ""
read -p "请输入要恢复的备份文件编号 (1-$(ls $BACKUP_DIR/backup_*.sql | wc -l)): " choice

# 获取备份文件路径
BACKUP_FILE=$(ls $BACKUP_DIR/backup_*.sql | sed -n "${choice}p")

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ 备份文件不存在！"
    exit 1
fi

echo "📍 选择的备份文件: $BACKUP_FILE"

# 确认操作
read -p "⚠️  确定要恢复这个备份吗？当前数据库将被覆盖！(y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "❌ 操作已取消"
    exit 0
fi

# 检查容器是否运行
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ 数据库容器未运行！请先启动本地开发环境"
    exit 1
fi

echo "🔄 开始恢复数据库..."

# 执行恢复
docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "✅ 数据库恢复成功！"
    echo "🎉 恢复完成，可以继续开发了！"
else
    echo "❌ 数据库恢复失败！"
    exit 1
fi