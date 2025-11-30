# 🚀 老王的Supabase MCP服务器配置指南

## 📋 配置完成情况

✅ **MCP配置文件**: `.mcp.json` 已创建
✅ **MCP服务器**: `supabase-mcp-server.js` 已创建
✅ **环境变量**: `.env.local` 已创建
✅ **安全配置**: Git已忽略敏感文件

## 🔧 MCP服务器功能

### 可用工具
1. **supabase_query** - 执行SQL查询
2. **supabase_insert** - 插入数据
3. **supabase_update** - 更新数据
4. **supabase_select** - 查询数据
5. **supabase_delete** - 删除数据

## 🚀 启动MCP服务器

### 方法1: 使用npm脚本
```bash
npm run mcp:supabase
```

### 方法2: 直接运行
```bash
node supabase-mcp-server.js
```

### 方法3: 设置环境变量后运行
```bash
export SUPABASE_URL="https://qxqbqllpdbjpheynezh.supabase.co"
export SUPABASE_ANON_KEY="your_anon_key"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
node supabase-mcp-server.js
```

## 📝 使用示例

### 1. 查询数据
```json
{
  "method": "tools/call",
  "params": {
    "name": "supabase_select",
    "arguments": {
      "table": "payment_qrcodes",
      "columns": "payment_type, qr_code_url, status",
      "limit": 10
    }
  }
}
```

### 2. 插入数据
```json
{
  "method": "tools/call",
  "params": {
    "name": "supabase_insert",
    "arguments": {
      "table": "recharge_requests",
      "data": {
        "user_id": "uuid",
        "amount": 100.00,
        "points": 1000,
        "payment_method": "wechat",
        "status": 0
      }
    }
  }
}
```

### 3. 更新数据
```json
{
  "method": "tools/call",
  "params": {
    "name": "supabase_update",
    "arguments": {
      "table": "recharge_requests",
      "data": {
        "status": 1,
        "processed_at": "2024-01-01T12:00:00Z"
      },
      "filter": {
        "id": "request_id"
      }
    }
  }
}
```

## 🔒 安全注意事项

1. **环境变量** - 所有敏感信息都存储在`.env.local`
2. **Git忽略** - `.env.local`和`.mcp.json`已被`.gitignore`排除
3. **生产环境** - 使用不同的环境变量文件
4. **密钥轮换** - 定期更换Supabase密钥

## 🐛 故障排除

### 常见错误

1. **环境变量未设置**
   ```
   错误: 缺少Supabase配置：SUPABASE_URL 和 SUPABASE_ANON_KEY 环境变量
   解决: 检查.env.local文件是否正确配置
   ```

2. **连接失败**
   ```
   错误: Supabase连接失败
   解决: 检查网络连接和Supabase项目状态
   ```

3. **权限不足**
   ```
   错误: permission denied for table
   解决: 检查Supabase RLS策略设置
   ```

### 测试连接
```bash
# 测试MCP服务器是否正常启动
npm run mcp:supabase

# 应该看到类似输出：
# 🔧 老王的Supabase MCP服务器启动中...
# 📍 项目URL: https://qxqbqllpdbjpheynezh.supabase.co
# ✅ Supabase连接成功！
```

## 📚 相关文档

- [Supabase官方文档](https://supabase.com/docs)
- [MCP协议规范](https://modelcontextprotocol.io/)
- [老王的数据库设置指南](老王-数据库设置指南.md)

## 🎯 下一步

1. ✅ 配置已完成，可以启动MCP服务器
2. 🔄 在Claude Code中测试MCP工具
3. 📊 使用MCP工具管理Supabase数据
4. 🚀 集成到你的开发工作流

---

**老王提示**: 配置完成后，记得重启你的开发环境让环境变量生效！有啥问题找老王，我来帮你解决！