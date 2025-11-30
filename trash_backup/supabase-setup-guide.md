# Supabase 数据库设置指南

## 📋 执行步骤

### 1. 登录 Supabase 控制台
- 访问: https://app.supabase.com
- 项目: `qxqbqllpdbjpheynezh`
- URL: https://qxqbqllpdbjpheynezh.supabase.co

### 2. 进入 SQL 编辑器
- 在左侧导航栏选择 "SQL Editor"
- 点击 "New query" 创建新查询

### 3. 执行数据库设置脚本
复制并执行 `complete-database-setup.sql` 文件中的所有SQL代码

## 🎯 创建的表结构

### payment_qrcodes（收款二维码表）
```sql
- id: 主键
- payment_type: 支付类型（微信、支付宝）
- qr_code_url: 二维码图片链接
- description: 描述信息
- is_active: 是否启用
- created_at: 创建时间
- updated_at: 更新时间
```

### recharge_requests（充值请求表）
```sql
- id: 主键
- user_id: 用户ID（外键）
- amount: 充值金额
- payment_type: 支付类型
- payment_proof: 支付凭证
- status: 状态（pending/approved/rejected/completed）
- remark: 备注
- processed_by: 处理人
- processed_at: 处理时间
- created_at: 创建时间
- updated_at: 更新时间
```

## 🔄 触发器和函数

### 自动更新时间戳
- `update_updated_at_column()` 函数
- 自动更新表的 `updated_at` 字段

### 统计函数
- `get_recharge_stats()` 获取充值统计数据

## ✅ 验证执行结果

执行完SQL后，可以运行以下查询验证：

```sql
-- 检查收款二维码数据
SELECT * FROM payment_qrcodes;

-- 检查充值请求表结构
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'recharge_requests';

-- 检查触发器
SELECT * FROM information_schema.triggers
WHERE event_object_table IN ('payment_qrcodes', 'recharge_requests');
```

## 🔧 前端集成

### 获取收款二维码
```javascript
const { data, error } = await supabase
  .from('payment_qrcodes')
  .select('*')
  .eq('is_active', true);
```

### 提交充值请求
```javascript
const { data, error } = await supabase
  .from('recharge_requests')
  .insert([{
    user_id: userId,
    amount: 100.00,
    payment_type: '微信',
    payment_proof: '凭证图片URL',
    remark: '用户备注'
  }]);
```

### 查询充值记录
```javascript
const { data, error } = await supabase
  .from('recharge_requests')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

## 🚨 注意事项

1. **默认二维码**: 使用SVG格式的占位二维码，显示支付方式名称
2. **实际使用**: 需要替换为真实的收款二维码图片URL
3. **权限**: 确保应用有正确的RLS（Row Level Security）策略
4. **外键**: `user_id` 引用 `auth.users` 表

## 📞 支持

如果遇到问题，请检查：
- Supabase 连接状态
- SQL 语法错误
- 表是否已存在
- 权限设置是否正确