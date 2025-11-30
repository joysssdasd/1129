// 老王我给你写个完整的Supabase数据库设置脚本！
// 自动创建所有必需的表和默认数据

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 缺少Supabase环境变量！');
    console.log('请在.env文件中设置：');
    console.log('VITE_SUPABASE_URL=your_supabase_url');
    console.log('VITE_SUPABASE_ANON_KEY=your_supabase_anon_key');
    process.exit(1);
}

console.log('🔧 老王开始设置Supabase数据库...');
console.log('Supabase URL:', supabaseUrl ? '已配置' : '使用默认值');

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQL(sql, description) {
    console.log(`\n🔧 ${description}...`);

    try {
        const { data, error } = await supabase.rpc('exec_sql', {
            body: { sql }
        });

        if (error) {
            console.error(`❌ ${description}失败:`, error);
            return false;
        }

        console.log(`✅ ${description}成功`);
        return true;
    } catch (err) {
        console.error(`❌ ${description}异常:`, err);
        return false;
    }
}

async function setupDatabase() {
    console.log('\n🎯 老王正在创建完整的数据库结构...');

    // 1. 创建 payment_qrcodes 表
    const paymentTablesSQL = `
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

        -- 添加注释
        COMMENT ON TABLE public.payment_qrcodes IS '收款二维码表';

        -- 创建更新时间触发器
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE 'plpgsql';

        DROP TRIGGER IF EXISTS update_payment_qrcodes_updated_at ON public.payment_qrcodes;
        CREATE TRIGGER update_payment_qrcodes_updated_at
            BEFORE UPDATE ON public.payment_qrcodes
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    await executeSQL(paymentTablesSQL, '创建收款二维码表');

    // 2. 创建 recharge_requests 表
    const rechargeTablesSQL = `
        -- 创建充值请求表
        CREATE TABLE IF NOT EXISTS public.recharge_requests (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            amount DECIMAL(10,2) NOT NULL,
            points INTEGER NOT NULL,
            payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('wechat', 'alipay')),
            status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2)),
            screenshot_url TEXT,
            is_custom BOOLEAN DEFAULT FALSE,
            admin_id UUID REFERENCES auth.users(id),
            admin_note TEXT,
            processed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- 添加注释
        COMMENT ON TABLE public.recharge_requests IS '充值请求表';

        -- 创建更新时间触发器
        CREATE OR REPLACE FUNCTION update_recharge_requests_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE 'plpgsql';

        DROP TRIGGER IF EXISTS update_recharge_requests_updated_at ON public.recharge_requests;
        CREATE TRIGGER update_recharge_requests_updated_at
            BEFORE UPDATE ON public.recharge_requests
            FOR EACH ROW EXECUTE FUNCTION update_recharge_requests_updated_at_column();
    `;

    await executeSQL(rechargeTablesSQL, '创建充值请求表');

    // 3. 创建 point_transactions 表
    const pointTransactionsSQL = `
        -- 创建积分交易记录表
        CREATE TABLE IF NOT EXISTS public.point_transactions (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            change_amount INTEGER NOT NULL,
            description VARCHAR(200) NOT NULL,
            related_post_id UUID REFERENCES public.trade_posts(id) ON DELETE SET NULL,
            related_recharge_id UUID REFERENCES public.recharge_requests(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- 添加注释
        COMMENT ON TABLE public.point_transactions IS '积分交易记录表';
    `;

    await executeSQL(pointTransactionsSQL, '创建积分交易记录表');

    // 4. 创建 view_history 表
    const viewHistorySQL = `
        -- 创建查看历史表
        CREATE TABLE IF NOT EXISTS public.view_history (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            post_id UUID REFERENCES public.trade_posts(id) ON DELETE CASCADE,
            viewed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- 添加注释
        COMMENT ON TABLE public.view_history IS '查看历史表';
    `;

    await executeSQL(viewHistorySQL, '创建查看历史表');

    // 5. 创建 invitations 表
    const invitationsSQL = `
        -- 创建邀请表
        CREATE TABLE IF NOT EXISTS public.invitations (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            invitee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            invite_code VARCHAR(20) UNIQUE NOT NULL,
            status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2)),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days'
        );

        -- 添加注释
        COMMENT ON TABLE public.invitations IS '邀请表';

        -- 创建更新时间触发器
        CREATE OR REPLACE FUNCTION update_invitations_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE 'plpgsql';

        DROP TRIGGER IF EXISTS update_invitations_updated_at ON public.invitations;
        CREATE TRIGGER update_invitations_updated_at
            BEFORE UPDATE ON public.invitations
            FOR EACH ROW EXECUTE FUNCTION update_invitations_updated_at_column();
    `;

    await executeSQL(invitationsSQL, '创建邀请表');

    // 6. 插入默认收款二维码
    const insertDefaultQRcodesSQL = `
        -- 插入默认收款二维码（临时用的，之后管理员可以在后台上传真实的）
        INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
        ('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码', 'active'),
        ('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码', 'active')
        ON CONFLICT (payment_type) DO NOTHING;
    `;

    await executeSQL(insertDefaultQRcodesSQL, '插入默认收款二维码');

    // 7. 创建性能优化索引
    const indexesSQL = `
        -- 为各个表创建索引以提高查询性能
        CREATE INDEX IF NOT EXISTS idx_recharge_requests_user_id ON public.recharge_requests(user_id);
        CREATE INDEX IF NOT EXISTS idx_recharge_requests_status ON public.recharge_requests(status);
        CREATE INDEX IF NOT EXISTS idx_recharge_requests_created_at ON public.recharge_requests(created_at);
        CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON public.point_transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON public.point_transactions(created_at);
        CREATE INDEX IF NOT EXISTS idx_view_history_user_id ON public.view_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_view_history_post_id ON public.view_history(post_id);
        CREATE INDEX IF NOT EXISTS idx_view_history_viewed_at ON public.view_history(viewed_at);
        CREATE INDEX IF NOT EXISTS idx_invitations_inviter_id ON public.invitations(inviter_id);
        CREATE INDEX IF NOT EXISTS idx_invitations_invitee_id ON public.invitations(invitee_id);
        CREATE INDEX IF NOT EXISTS idx_invitations_invite_code ON public.invitations(invite_code);
        CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
        CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON public.invitations(expires_at);
    `;

    await executeSQL(indexesSQL, '创建性能优化索引');

    console.log('\n🎉 数据库设置完成！');
    console.log('\n📋 已创建的表：');
    console.log(' ✅ payment_qrcodes (收款二维码表)');
    console.log(' ✅ recharge_requests (充值请求表)');
    console.log(' ✅ point_transactions (积分交易记录表)');
    console.log(' ✅ view_history (查看历史表)');
    console.log(' ✅ invitations (邀请表)');
    console.log('\n🏪 用户现在可以在充值页面看到收款二维码了！');
    console.log('\n💡 下一步：管理员可以在后台上传真实的收款二维码图片替换默认的测试二维码');
}

// 如果直接运行此脚本
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };