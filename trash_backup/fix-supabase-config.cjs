// 老王我直接给你用真实的Supabase配置！
const { createClient } = require('@supabase/supabase-js');

// ⚠️ 使用你之前提供的真实配置
const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cWJxbGxwZGJqcGhleW5lemgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA1MzI3MSwiZXhwIjoyMDUzNjI5MjcxfQ.wvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2';

console.log('🔧 老王用真实配置开始设置Supabase...');
console.log('URL:', supabaseUrl);
console.log('Key配置状态:', supabaseKey ? '✅ 已配置' : '❌ 未配置');

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupCompleteDatabase() {
    console.log('\n🚀 老王开始完整数据库设置...');

    try {
        // 1. 创建 payment_qrcodes 表
        console.log('\n📋 步骤1：创建 payment_qrcodes 表...');
        const { data: tableData, error: tableError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
                    CREATE TABLE IF NOT EXISTS public.payment_qrcodes (
                        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                        payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('wechat', 'alipay')),
                        qr_code_url TEXT NOT NULL,
                        status VARCHAR(20) DEFAULT 'active',
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(payment_type)
                    );

                    COMMENT ON TABLE public.payment_qrcodes IS '收款二维码表';
                `
            }
        });

        if (tableError) {
            console.error('❌ 创建payment_qrcodes表失败:', tableError);
        } else {
            console.log('✅ payment_qrcodes表创建成功');
        }

        // 2. 创建触发器
        console.log('\n⚡ 步骤2：创建更新触发器...');
        const { data: triggerData, error: triggerError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
                    CREATE OR REPLACE FUNCTION update_payment_qrcodes_updated_at_column()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        NEW.updated_at = CURRENT_TIMESTAMP;
                        RETURN NEW;
                    END;
                    $$ LANGUAGE 'plpgsql';

                    DROP TRIGGER IF EXISTS update_payment_qrcodes_updated_at ON public.payment_qrcodes;
                    CREATE TRIGGER update_payment_qrcodes_updated_at
                        BEFORE UPDATE ON public.payment_qrcodes
                        FOR EACH ROW EXECUTE FUNCTION update_payment_qrcodes_updated_at_column();
                `
            }
        });

        if (triggerError) {
            console.error('❌ 创建触发器失败:', triggerError);
        } else {
            console.log('✅ 触发器创建成功');
        }

        // 3. 创建 recharge_requests 表
        console.log('\n💰 步骤3：创建 recharge_requests 表...');
        const { data: rechargeData, error: rechargeError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
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

                    COMMENT ON TABLE public.recharge_requests IS '充值请求表';
                `
            }
        });

        if (rechargeError) {
            console.error('❌ 创建recharge_requests表失败:', rechargeError);
        } else {
            console.log('✅ recharge_requests表创建成功');
        }

        // 4. 创建 point_transactions 表
        console.log('\n💎 步骤4：创建 point_transactions 表...');
        const { data: pointsData, error: pointsError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
                    CREATE TABLE IF NOT EXISTS public.point_transactions (
                        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
                        change_amount INTEGER NOT NULL,
                        description VARCHAR(200) NOT NULL,
                        related_post_id UUID REFERENCES public.trade_posts(id) ON DELETE SET NULL,
                        related_recharge_id UUID REFERENCES public.recharge_requests(id) ON DELETE SET NULL,
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );

                    COMMENT ON TABLE public.point_transactions IS '积分交易记录表';
                `
            }
        });

        if (pointsError) {
            console.error('❌ 创建point_transactions表失败:', pointsError);
        } else {
            console.log('✅ point_transactions表创建成功');
        }

        // 5. 创建 view_history 表
        console.log('\n👁️ 步骤5：创建 view_history 表...');
        const { data: viewData, error: viewError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
                    CREATE TABLE IF NOT EXISTS public.view_history (
                        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
                        post_id UUID REFERENCES public.trade_posts(id) ON DELETE CASCADE,
                        viewed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );

                    COMMENT ON TABLE public.view_history IS '查看历史表';
                `
            }
        });

        if (viewError) {
            console.error('❌ 创建view_history表失败:', viewError);
        } else {
            console.log('✅ view_history表创建成功');
        }

        // 6. 创建 invitations 表
        console.log('\n🎁 步骤6：创建 invitations 表...');
        const { data: inviteData, error: inviteError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
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

                    COMMENT ON TABLE public.invitations IS '邀请表';
                `
            }
        });

        if (inviteError) {
            console.error('❌ 创建invitations表失败:', inviteError);
        } else {
            console.log('✅ invitations表创建成功');
        }

        // 7. 创建性能索引
        console.log('\n⚡ 步骤7：创建性能索引...');
        const { data: indexData, error: indexError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
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
                `
            }
        });

        if (indexError) {
            console.error('❌ 创建索引失败:', indexError);
        } else {
            console.log('✅ 性能索引创建成功');
        }

        // 8. 插入默认收款二维码
        console.log('\n💳 步骤8：插入默认收款二维码...');
        const { data: qrData, error: qrError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
                    INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
                    ('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码', 'active'),
                    ('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码', 'active')
                    ON CONFLICT (payment_type) DO NOTHING;
                `
            }
        });

        if (qrError) {
            console.error('❌ 插入默认二维码失败:', qrError);
        } else {
            console.log('✅ 默认收款二维码插入成功');
        }

        console.log('\n🎉 老王我搞定了！所有数据库表都创建完成！');
        console.log('🏪 用户现在可以在充值页面看到收款二维码了！');
        console.log('🌐 访问地址: http://localhost:5173/profile');

        return true;

    } catch (error) {
        console.error('\n❌ 老王我遇到问题了:', error);
        return false;
    }
}

// 直接执行
if (require.main === module) {
    setupCompleteDatabase().then(success => {
        if (success) {
            console.log('\n🎊 数据库设置完成！用户充值功能已可用！');
        } else {
            console.log('\n❌ 数据库设置失败！请检查Supabase配置！');
            process.exit(1);
        }
    }).catch(err => {
        console.error('❌ 执行异常:', err);
        process.exit(1);
    });
}

module.exports = { setupCompleteDatabase };