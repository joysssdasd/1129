# Supabase数据库修复完整说明

## 当前状态
- 项目地址: http://localhost:5177/
- Supabase URL: https://qxqbqllpdbjpheynezh.supabase.co
- Supabase Dashboard: https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh

## 问题分析
1. 数据库表 `payment_qrcodes` 不存在
2. 需要插入默认的微信和支付宝收款二维码
3. 前端配置已更新为正确的密钥

## 解决方案

### 步骤1: 手动执行SQL脚本

请访问 Supabase Dashboard 的 SQL 编辑器：
https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/sql

复制并执行以下文件中的完整SQL内容：
**文件路径**: `E:\claude15\trade-platform\payment-qrcodes-setup.sql`

SQL脚本将创建：
- `payment_qrcodes` 表（收款二维码表）
- `recharge_requests` 表（充值请求表）
- `point_transactions` 表（积分交易记录表）
- 相关触发器和索引
- 默认的微信和支付宝收款二维码数据

### 步骤2: 验证设置

执行SQL后，运行验证脚本：
```bash
cd E:\claude15\trade-platform
node verify-database.cjs
```

### 步骤3: 测试前端功能

1. 确保项目正在运行:
   ```bash
   npm run dev
   ```

2. 访问: http://localhost:5177/profile

3. 点击充值按钮，确认能看到：
   - 微信收款二维码
   - 支付宝收款二维码

## 重要文件

### 数据库配置文件
- `src/services/supabase.ts` - 已更新为正确密钥
- `payment-qrcodes-setup.sql` - 完整的SQL创建脚本
- `verify-database.cjs` - 数据库验证脚本
- `test-supabase-connection.cjs` - 连接测试脚本

### 自动化脚本
- `fix-supabase-config.cjs` - 完整数据库设置脚本（网络问题时手动执行SQL）
- `fix-payment-qrcodes.cjs` - 专门修复收款二维码表

## SQL脚本内容预览

```sql
-- 创建收款二维码表
CREATE TABLE IF NOT EXISTS public.payment_qrcodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('wechat', 'alipay')),
    qr_code_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payment_type)
);

-- 插入默认数据
INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码', 'active'),
('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码', 'active')
ON CONFLICT (payment_type) DO NOTHING;
```

## 验证成功标准

执行完所有步骤后，您应该看到：
- ✅ payment_qrcodes表存在
- ✅ 包含微信和支付宝两条记录
- ✅ 前端能正常获取收款二维码数据
- ✅ 充值页面显示二维码图片

## 故障排除

### 如果连接失败
1. 检查网络连接
2. 确认Supabase URL正确
3. 确认API密钥有效

### 如果表创建失败
1. 确保在Supabase Dashboard中执行SQL
2. 检查SQL语法是否正确
3. 确保用户权限足够

### 如果前端无法获取数据
1. 检查浏览器控制台错误
2. 确认API密钥配置正确
3. 检查表名和字段名是否匹配

## 完成后测试流程

1. 访问 http://localhost:5177/profile
2. 点击充值按钮
3. 确认看到支付方式选择
4. 确认能看到对应的二维码图片
5. 测试完整的充值提交流程

## 技术支持

如果在执行过程中遇到问题：
1. 检查 `verify-database.cjs` 的输出
2. 查看Supabase Dashboard的错误日志
3. 检查浏览器控制台的API请求状态
4. 确认所有文件都使用相同的Supabase配置