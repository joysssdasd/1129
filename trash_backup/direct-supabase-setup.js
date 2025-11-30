// 老王直接连Supabase完成数据库设置！
const { createClient } = require('@supabase/supabase-js');

// 直接硬编码，不用环境变量
const supabaseUrl = 'https://your-project.supabase.co'; // 替换为你的实际URL
const supabaseKey = 'your-anon-key'; // 替换为你的实际ANON key

console.log('🔧 老王直接连Supabase，创建payment_qrcodes表...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function createPaymentQRCodesTable() {
    try {
        const { data, error } = await supabase.rpc('exec_sql', {
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

        if (error) {
            console.error('❌ 创建payment_qrcodes表失败:', error);
            return false;
        }

        console.log('✅ payment_qrcodes表创建成功');

        // 创建触发器
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
                        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
                `
            }
        });

        if (triggerError) {
            console.error('❌ 创建payment_qrcodes触发器失败:', triggerError);
            return false;
        }

        console.log('✅ payment_qrcodes触发器创建成功');

        // 插入默认数据
        const { data: insertData, error: insertError } = await supabase.rpc('exec_sql', {
            body: {
                sql: `
                    INSERT INTO public.payment_qrcodes (payment_type, qr_code_url, status) VALUES
                    ('wechat', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码', 'active'),
                    ('alipay', 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码', 'active')
                    ON CONFLICT (payment_type) DO NOTHING;
                `
            }
        });

        if (insertError) {
            console.error('❌ 插入默认收款二维码失败:', insertError);
            return false;
        }

        console.log('✅ 默认收款二维码插入成功');
        console.log('🎉 payment_qrcodes表完全设置完成！');
        console.log('🏪 用户现在可以在充值页面看到收款二维码了！');

        return true;

    } catch (error) {
        console.error('❌ 设置payment_qrcodes表失败:', error);
        return false;
    }
}

// 直接执行
if (require.main === module) {
    createPaymentQRCodesTable();
}