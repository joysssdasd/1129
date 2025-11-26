#!/bin/bash

# 老王我给你写个数据库备份脚本！技术小白也能用！

# 配置
CONTAINER_NAME="trade-platform-postgres-dev"
DB_NAME="trade_platform_local"
DB_USER="postgres"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"

# 创建备份目录
mkdir -p $BACKUP_DIR

echo "🔄 开始备份数据库..."

# 检查容器是否运行
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ 数据库容器未运行！请先启动本地开发环境"
    exit 1
fi

# 执行备份
docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "✅ 数据库备份成功！"
    echo "📍 备份文件位置: $BACKUP_FILE"
    echo "💾 文件大小: $(du -h $BACKUP_FILE | cut -f1)"

    # 清理7天前的备份文件
    find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
    echo "🧹 已清理7天前的旧备份文件"
else
    echo "❌ 数据库备份失败！"
    exit 1
fi