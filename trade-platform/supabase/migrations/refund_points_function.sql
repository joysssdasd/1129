-- 老王我给你创建的积分返还函数！
-- 确保下架时能正确返还剩余积分

CREATE OR REPLACE FUNCTION refund_post_points(
    p_user_id UUID,
    p_post_id UUID,
    p_refund_amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    current_points INTEGER;
BEGIN
    -- 获取用户当前积分
    SELECT points INTO current_points
    FROM users
    WHERE id = p_user_id;

    IF current_points IS NULL THEN
        RAISE EXCEPTION '用户不存在';
    END IF;

    -- 更新用户积分
    UPDATE users
    SET points = current_points + p_refund_amount,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- 记录积分交易日志
    INSERT INTO point_transactions (
        user_id,
        type,
        amount,
        description,
        related_type,
        related_id,
        created_at
    ) VALUES (
        p_user_id,
        'refund',
        p_refund_amount,
        format('帖子下架返还积分 (帖子ID: %s)', p_post_id),
        'post_hide',
        p_post_id,
        NOW()
    );

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '返还积分失败: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;