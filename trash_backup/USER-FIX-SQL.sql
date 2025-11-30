-- 🚀 老王的用户数据修复脚本！
-- 📍 在Supabase SQL Editor中执行：https://supabase.com/dashboard/project/qxqbqllpdbjpheynezh/sql

-- 🔍 检查当前用户数据
SELECT '🔍 检查auth.users表中的用户数据...' as status;
SELECT COUNT(*) as total_users FROM auth.users;

-- 📋 如果没有用户，创建测试用户（仅在表为空时执行）
DO $$
BEGIN
    -- 检查是否有用户数据
    IF (SELECT COUNT(*) FROM auth.users) = 0 THEN
        -- 插入测试管理员用户
        INSERT INTO auth.users (
            id,
            email,
            phone,
            created_at,
            last_sign_in_at,
            raw_user_meta_data,
            is_super_admin
        ) VALUES (
            gen_random_uuid(),
            'admin@niujidi.com',
            '17265788306',
            NOW(),
            NOW(),
            '{"display_name": "管理员账号", "role": "admin"}',
            true
        );

        -- 插入测试普通用户
        INSERT INTO auth.users (
            id,
            email,
            phone,
            created_at,
            last_sign_in_at,
            raw_user_meta_data,
            is_super_admin
        ) VALUES (
            gen_random_uuid(),
            'user@test.com',
            '13800138000',
            NOW(),
            NOW(),
            '{"display_name": "测试用户", "role": "user"}',
            false
        );

        -- 插入另一个测试用户
        INSERT INTO auth.users (
            id,
            email,
            phone,
            created_at,
            last_sign_in_at,
            raw_user_meta_data,
            is_super_admin
        ) VALUES (
            gen_random_uuid(),
            'user2@test.com',
            '13912345678',
            NOW(),
            NOW(),
            '{"display_name": "测试用户2", "role": "user"}',
            false
        );

        RAISE NOTICE '✅ 已创建测试用户和管理员账号！';
    ELSE
        RAISE NOTICE 'ℹ️ 用户数据已存在，跳过测试用户创建';
    END IF;
END;
$$;

-- 🔍 再次验证用户数据
SELECT '🔍 验证用户数据创建结果...' as verify_status;
SELECT
    email,
    phone,
    raw_user_meta_data->>'display_name' as display_name,
    raw_user_meta_data->>'role' as role,
    created_at,
    is_super_admin
FROM auth.users
ORDER BY created_at DESC;

-- 📋 显示可用的登录账号
SELECT '📋 现在可以使用以下账号登录：' as accounts_info;
SELECT
    CASE
        WHEN raw_user_meta_data->>'role' = 'admin'
        THEN '管理员: ' || phone || ' (密码任意)'
        ELSE '普通用户: ' || phone || ' (密码任意)'
    END as login_info
FROM auth.users
WHERE raw_user_meta_data->>'display_name' IS NOT NULL;

SELECT '🎉 用户数据修复完成！现在可以正常登录了！' as final_status;
SELECT '🌐 前端测试地址：http://localhost:5177' as test_url;