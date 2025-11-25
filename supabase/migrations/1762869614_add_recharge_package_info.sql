-- Migration: add_recharge_package_info
-- Created at: 1762869614

ALTER TABLE recharge_requests 
ADD COLUMN package_name TEXT,
ADD COLUMN is_custom BOOLEAN DEFAULT FALSE;;