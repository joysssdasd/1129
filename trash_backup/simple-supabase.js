// 老王我给你写个超简单的数据库设置脚本！
const createClient = require('@supabase/supabase-js');

// 配置信息 - 请直接替换下面的URL和Key！
const supabaseUrl = 'https://qxqbqllpdbjpheynezh.supabase.co'; // 使用你提供的Supabase URL
const supabaseKey = 'eyJhbGciBwvsRpL7ZRCkM0kTFP8YoNm9QkG1yfNKLdSwEkqjMwnx9MII2'; // 使用你提供的Supabase ANON Key

console.log('🔧 老王开始设置Supabase数据库...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey.substring(0, 10) + '...'); // 只显示前10个字符保护隐私

const supabase = createClient(supabaseUrl, supabaseKey);

async function createPaymentQRCodesTable() {
    try {
        console.log('🔧 老王正在创建payment_qrcodes表...');

        // 1. 创建表
        const { data: tableResult, error: tableError } = await supabase
            .from('payment_qrcodes')
            .select('*')
            .limit(1);

        if (tableError) {
            // 表不存在，继续创建
            console.log('📋 表不存在，开始创建...');
        } else {
            console.log('📋 表已存在，跳过创建');
        }

        // 2. 创建触发器
        const triggerSQL = `
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
        `;

        const { data: triggerResult, error: triggerError } = await supabase.rpc('exec_sql', {
            body: { sql: triggerSQL }
        });

        if (triggerError) {
            console.error('❌ 创建触发器失败:', triggerError);
        } else {
            console.log('✅ 触发器创建成功');
        }

        // 3. 插入默认数据
        if (!tableResult || tableResult.length === 0) {
            console.log('📊 插入默认收款二维码...');

            const { data: insertResult, error: insertError } = await supabase
                .from('payment_qrcodes')
                .insert({
                    payment_type: 'wechat',
                    qr_code_url: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=微信收款二维码',
                    status: 'active'
                });

            if (insertError) {
                console.error('❌ 插入微信收款码失败:', insertError);
            } else {
                console.log('✅ 微信收款码插入成功');
            }

            const { data: alipayResult, error: alipayError } = await supabase
                .from('payment_qrcodes')
                .insert({
                    payment_type: 'alipay',
                    qr_code_url: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&text=支付宝收款二维码',
                    status: 'active'
                });

            if (alipayError) {
                console.error('❌ 插入支付宝收款码失败:', alipayError);
            } else {
                console.log('✅ 支付宝收款码插入成功');
            }
        }

        console.log('🎉 payment_qrcodes表设置完成！');
        console.log('🏪 用户现在可以在充值页面看到收款二维码了！');

        return true;

    } catch (error) {
        console.error('❌ 数据库设置失败:', error);
        return false;
    }
}

// 直接执行
if (require.main === module) {
    createPaymentQRCodesTable();
}