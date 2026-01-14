-- 修复自动下架定时任务
-- 问题：cron job 配置中的 Supabase URL 错误

-- 1. 首先删除旧的 cron job（如果存在）
SELECT cron.unschedule('auto-expire-posts_invoke');

-- 2. 删除旧的存储过程（如果存在）
DROP PROCEDURE IF EXISTS auto_expire_posts_471e08d2();

-- 3. 创建新的存储过程（使用正确的 URL）
CREATE OR REPLACE PROCEDURE auto_expire_posts_proc()
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM net.http_post(
        url := 'https://hntiihuxqlklpiyqmlob.supabase.co/functions/v1/auto-expire-posts',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := '{"source":"cron"}',
        timeout_milliseconds := 30000
    );
END;
$$;

-- 4. 创建新的 cron job（每小时执行一次）
SELECT cron.schedule(
    'auto-expire-posts_invoke',
    '0 * * * *',  -- 每小时整点执行
    'CALL auto_expire_posts_proc()'
);

-- 5. 验证 cron job 是否创建成功
SELECT * FROM cron.job WHERE jobname = 'auto-expire-posts_invoke';
