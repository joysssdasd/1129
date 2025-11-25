-- Migration: test_and_cleanup_payment_qrcodes
-- Created at: 1762867078

-- 插入支付宝测试数据
INSERT INTO payment_qrcodes (payment_type, qr_code_url) 
VALUES ('alipay', 'https://example.com/alipay-qr-test.png');

-- 删除所有测试数据
DELETE FROM payment_qrcodes WHERE qr_code_url LIKE '%test.png';;