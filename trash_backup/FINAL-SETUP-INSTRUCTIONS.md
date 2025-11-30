# 🚨 重要：Supabase 数据库设置最终指令

## ⚡ 快速执行步骤

### 1. 立即执行 SQL 设置脚本

**方法一：复制粘贴到 Supabase SQL 编辑器**
```
1. 访问: https://app.supabase.com
2. 选择项目: qxqbqllpdbjpheynezh
3. 点击左侧 "SQL Editor" → "New query"
4. 复制 `complete-database-setup.sql` 文件内容并粘贴
5. 点击 "RUN" 执行
```

**方法二：使用 HTTP 请求**
```bash
# 在终端中执行（如果有 curl）
curl -X POST "https://qxqbqllpdbjpheynezh.supabase.co/rest/v1/" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.wvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.wvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2"
```

## 📋 SQL 脚本核心内容（如果需要手动输入）

### 1. 创建 payment_qrcodes 表
```sql
CREATE TABLE IF NOT EXISTS payment_qrcodes (
  id SERIAL PRIMARY KEY,
  payment_type VARCHAR(50) NOT NULL UNIQUE,
  qr_code_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. 插入默认数据
```sql
INSERT INTO payment_qrcodes (payment_type, qr_code_url, description, is_active) VALUES
('微信', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJibGFjayI+5Li76aKY5pS/5Yqh5bmz5piM5pys6LSo77yM5pyA5aSa5L2T6Lev55S15Z2A5pS/5Yqh6ZyA5YWz5Y+K77yB5L2g5aW977yB5Li65LuA5LmQ6KGo77yM6aG555uu77yBPC90ZXh0Pgo8L3N2Zz4=', '微信收款二维码 - 请使用微信扫描进行充值', true),
('支付宝', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJibGFjayI+5p+Q5r2t5piM5pys6LSo77yM5pyA5aSa5L2T6Lev55S15Z2A5p+Q5r2t6ZyA5YWz5Y+K77yB5L2g5aW977yB5Li65LuA5LmQ6KGo77yM6aG555uu77yBPC90ZXh0Pgo8L3N2Zz4=', '支付宝收款二维码 - 请使用支付宝扫描进行充值', true);
```

### 3. 创建 recharge_requests 表
```sql
CREATE TABLE IF NOT EXISTS recharge_requests (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_type VARCHAR(50) NOT NULL,
  payment_proof TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  remark TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## ✅ 验证执行结果

执行完成后，在 Supabase SQL 编辑器中运行：

```sql
-- 检查表是否创建成功
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('payment_qrcodes', 'recharge_requests');

-- 检查收款二维码数据
SELECT * FROM payment_qrcodes;

-- 检查充值请求表结构
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'recharge_requests';
```

## 🔧 前端代码集成

### 更新你的前端服务文件
在你的项目中更新 Supabase 相关代码：

```typescript
// src/services/supabase.ts 或类似文件
export const getPaymentQRCodes = async () => {
  const { data, error } = await supabase
    .from('payment_qrcodes')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  return data;
};

export const submitRechargeRequest = async (requestData: {
  user_id: string;
  amount: number;
  payment_type: string;
  payment_proof?: string;
  remark?: string;
}) => {
  const { data, error } = await supabase
    .from('recharge_requests')
    .insert([requestData])
    .select();

  if (error) throw error;
  return data;
};
```

## 🎯 关键文件总结

我已经创建了以下文件供你使用：

1. **`complete-database-setup.sql`** - 完整的SQL设置脚本
2. **`supabase-setup-guide.md`** - 详细设置指南
3. **`verify-database-setup.cjs`** - 验证脚本
4. **`FINAL-SETUP-INSTRUCTIONS.md`** - 本文件

## ⚠️ 重要提醒

1. **立即执行SQL**: 请立即在 Supabase 控制台执行 SQL 脚本
2. **验证结果**: 执行后运行验证查询确认创建成功
3. **网络问题**: 如果当前网络有问题，可能需要稍后再试
4. **权限设置**: 之后需要配置适当的 RLS 策略

## 🆘 如果遇到问题

1. 检查 Supabase 项目状态
2. 确认服务密钥是否正确
3. 查看SQL执行日志
4. 联系 Supabase 支持

**执行完成后，前端就能正常显示收款二维码和处理充值请求了！**