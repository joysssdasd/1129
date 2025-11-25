-- Migration: create_indexes
-- Created at: 1762703612

-- 用户表索引
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_invite_code ON users(invite_code);
CREATE INDEX idx_users_status ON users(status);

-- 交易信息表索引
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_trade_type ON posts(trade_type);
CREATE INDEX idx_posts_expire_at ON posts(expire_at);
CREATE INDEX idx_posts_status_created ON posts(status, created_at DESC);

-- 积分流水表索引
CREATE INDEX idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX idx_point_transactions_created_at ON point_transactions(created_at DESC);
CREATE INDEX idx_point_transactions_change_type ON point_transactions(change_type);

-- 充值申请表索引
CREATE INDEX idx_recharge_requests_user_id ON recharge_requests(user_id);
CREATE INDEX idx_recharge_requests_status ON recharge_requests(status);
CREATE INDEX idx_recharge_requests_created_at ON recharge_requests(created_at DESC);

-- 查看历史表索引
CREATE INDEX idx_view_history_user_id ON view_history(user_id);
CREATE INDEX idx_view_history_post_id ON view_history(post_id);
CREATE INDEX idx_view_history_viewed_at ON view_history(viewed_at DESC);

-- 邀请记录表索引
CREATE INDEX idx_invitations_inviter_code ON invitations(inviter_code);
CREATE INDEX idx_invitations_invitee_id ON invitations(invitee_id);

-- 验证码表索引
CREATE INDEX idx_verification_codes_phone ON verification_codes(phone);
CREATE INDEX idx_verification_codes_expires_at ON verification_codes(expires_at);

-- 公告表索引
CREATE INDEX idx_announcements_is_active ON announcements(is_active);
CREATE INDEX idx_announcements_priority ON announcements(priority DESC);;