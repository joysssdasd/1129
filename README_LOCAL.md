# 🚀 本地测试环境快速上手

## 💻 老王的一键启动方案

### 方法1：无Docker版（推荐）
```bash
# Windows用户
start-local-nodocker.bat

# 选择启动模式：
# 1) 仅前端应用
# 2) 前端 + 自动提交服务
# 3) 仅自动提交服务
```

### 方法2：Docker版（需要安装Docker）
```bash
# Windows用户
start-local.bat

# Mac/Linux用户
./start-local.sh
```

## 🎯 环境访问

| 服务 | 地址 | 说明 |
|------|------|------|
| **前端应用** | http://localhost:5173 | React开发服务器 |
| **Supabase** | 已配置云端 | 数据库服务 |

## ⚡ 快速测试

```bash
# 1. 启动环境
start-local-nodocker.bat  # 选择 1

# 2. 访问前端
# 浏览器打开: http://localhost:5173

# 3. 开始开发
# 修改 trade-platform/src/ 下的文件
# 保存后会自动热重载
```

## 🔧 常用操作

```bash
# 查看运行状态
start-local-nodocker.bat  # 选择 4

# 停止所有服务
start-local-nodocker.bat  # 选择 5

# 重启服务
start-local-nodocker.bat  # 选择对应模式
```

## 📁 重要文件

- `trade-platform/src/` - 前端源代码
- `auto-commit.js` - 自动提交服务
- `.env.local` - 本地配置文件
- `LOCAL_DEV_GUIDE.md` - 详细开发指南

## ⚠️ 注意事项

1. **首次运行**：可能需要安装依赖，耐心等待
2. **端口占用**：确保5173端口未被占用
3. **GitHub提交**：如需自动提交，配置GITHUB_TOKEN环境变量
4. **数据存储**：使用云端Supabase，本地无需数据库

## 🎉 完成！

环境已就绪，开始你的开发之旅！

**有问题就骂，老王帮你搞定！💪**