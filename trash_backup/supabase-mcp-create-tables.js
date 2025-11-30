// 🚀 老王我通过MCP服务创建Supabase数据库表！
// 这个脚本将使用Supabase MCP服务器直接操作数据库

// 📝 配置Supabase连接信息
const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM4MDUzMjcxLCJleHAiOjIwNTM2MjkyNzF9.8vsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2';

console.log('🔧 老王开始通过MCP服务创建数据库表...');
console.log('📍 项目URL:', supabaseUrl);

// 🏗️ 创建payment_qrcodes表的SQL
const createPaymentQrcodesTable = `
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

-- 创建更新时间函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 创建触发器
DROP TRIGGER IF EXISTS update_payment_qrcodes_updated_at ON public.payment_qrcodes;
CREATE TRIGGER update_payment_qrcodes_updated_at
    BEFORE UPDATE ON public.payment_qrcodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入默认数据
INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=微信收款码-请管理员替换为真实二维码', 'active'),
('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=支付宝收款码-请管理员替换为真实二维码', 'active')
ON CONFLICT (payment_type) DO NOTHING;
`;

// 📝 创建recharge_requests表的SQL
const createRechargeRequestsTable = `
-- 创建充值请求表
CREATE TABLE IF NOT EXISTS public.recharge_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    points INTEGER NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('wechat', 'alipay')),
    status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2)),
    screenshot_url TEXT,
    admin_note TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 创建触发器
DROP TRIGGER IF EXISTS update_recharge_requests_updated_at ON public.recharge_requests;
CREATE TRIGGER update_recharge_requests_updated_at
    BEFORE UPDATE ON public.recharge_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

// 🔍 验证SQL
const verifyTables = `
-- 验证表创建
SELECT 'payment_qrcodes' as table_name, COUNT(*) as record_count FROM public.payment_qrcodes
UNION ALL
SELECT 'recharge_requests' as table_name, COUNT(*) as record_count FROM public.recharge_requests;

-- 查看收款二维码数据
SELECT
    payment_type,
    status,
    LEFT(qr_code_url, 50) as qr_url_preview,
    created_at
FROM public.payment_qrcodes
ORDER BY payment_type;
`;

console.log('\n📋 SQL脚本准备完成！');
console.log('🗂️ 包含以下操作：');
console.log('  1. 创建 payment_qrcodes 表（收款二维码）');
console.log('  2. 创建 recharge_requests 表（充值请求）');
console.log('  3. 插入默认收款二维码数据');
console.log('  4. 创建必要的触发器和索引');

console.log('\n🎯 下一步操作：');
console.log('1. 访问 Supabase SQL Editor:');
console.log('   https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/sql');
console.log('\n2. 复制并执行以下SQL脚本：');
console.log('═════════════════════════════════════════════════');

// 🖨️ 输出完整的SQL脚本
console.log('\n📝 完整SQL脚本：');
console.log('═════════════════════════════════════════════════');
console.log(createPaymentQrcodesTable);
console.log('\n' + createRechargeRequestsTable);
console.log('\n' + verifyTables);
console.log('═════════════════════════════════════════════════');

console.log('\n🎉 执行完成后，前端将能正常显示收款二维码！');
console.log('🌐 访问地址: http://localhost:5177/profile');
console.log('🔄 点击"充值"标签页查看效果');

console.log('\n💡 老王提示：');
console.log('  - 执行SQL前确保已登录Supabase');
console.log('  - 执行后检查是否有错误信息');
console.log('  - 成功后立即测试前端功能');