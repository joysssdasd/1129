# 🤖 自动提交服务 - 老王出品

## 功能介绍

老王我给你写的这个自动提交服务，可以监控你的代码文件变化，自动提交到GitHub！再也不用手动提交代码了！

## 🚀 快速开始

### 1. 设置GitHub Token

```bash
# 设置环境变量（Windows）
set GITHUB_TOKEN="your_github_personal_access_token"

# 或者（Linux/Mac）
export GITHUB_TOKEN="your_github_personal_access_token"
```

### 2. 启动自动提交服务

```bash
# 确保已安装Node.js
node --version

# 启动服务
npm start
# 或者
node auto-commit.js
```

### 3. 享受自动提交

服务启动后会：
- ✅ 立即检查是否有未提交的更改
- 🔄 每30秒自动检查一次文件变化
- 🤖 智能生成中文提交信息
- 🚀 自动推送到GitHub

## 📝 配置说明

可以在 `auto-commit.js` 中修改配置：

```javascript
const CONFIG = {
  watchDir: './trade-platform',        // 监控的目录
  commitInterval: 30000,              // 检查间隔（30秒）
  exclude: ['node_modules', '.git'],  // 排除的文件
  repo: 'joysssdasd/1129'             // GitHub仓库名
};
```

## 🔧 GitHub Token 获取

1. 登录GitHub
2. 进入 Settings → Developer settings → Personal access tokens
3. 点击 "Generate new token (classic)"
4. 选择权限：`repo`（完整仓库权限）
5. 复制生成的token

## 📋 功能特点

### 🎯 智能提交信息
- 自动分析文件更改类型（新增/修改/删除）
- 统计不同类型文件数量
- 生成包含时间戳的中文提交信息

### ⚡ 实时监控
- 每30秒检查一次文件变化
- 支持批量文件提交
- 智能跳过重复提交

### 🛡️ 安全可靠
- 使用环境变量存储敏感信息
- 完善的错误处理机制
- 支持优雅退出（Ctrl+C）

## 💡 使用技巧

### 手动提交
如果需要立即提交，可以运行：
```bash
npm run commit
```

### 修改检查频率
编辑 `auto-commit.js` 中的 `commitInterval` 值：
```javascript
commitInterval: 60000, // 改为1分钟检查一次
```

### 排除特定文件
在 `exclude` 数组中添加不需要监控的文件：
```javascript
exclude: [
  'node_modules',
  '.git',
  'dist',
  '*.log',
  'temp/'
],
```

## 🐛 故障排除

### 问题1: 提交失败
**解决方案：**
1. 检查GitHub Token是否正确
2. 确认有仓库写入权限
3. 检查网络连接

### 问题2: 频繁提交空更改
**解决方案：**
- 调整检查间隔时间
- 检查是否有文件正在被编辑

### 问题3: Windows系统报错
**解决方案：**
```bash
# 使用管理员权限运行PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 🎉 效果展示

启动后你会看到类似这样的输出：
```
🚀 启动自动提交服务...
📁 监控目录: ./trade-platform
⏰ 检查间隔: 30秒
按 Ctrl+C 停止服务

✅ 没有未提交的更改

🔍 发现文件更改，开始自动提交...
📁 发现 3 个更改的文件
📝 提交信息: 🤖 自动提交: 更新 3个文件 [tsx(2), ts(1)] (2024/11/25 18:30:15)
🚀 推送到GitHub...
✅ 自动提交成功！
```

## 💬 老王的建议

1. **开发时启动服务**：写代码前先启动自动提交服务，专注开发无需关心提交
2. **合理设置间隔**：太频繁会消耗资源，太长会失去实时性
3. **重要手动提交**：重大功能完成后建议手动提交，写更详细的提交信息
4. **定期检查日志**：确保自动提交正常工作

---

🤖 *由老王精心打造的自动化工具，让你的开发更高效！*