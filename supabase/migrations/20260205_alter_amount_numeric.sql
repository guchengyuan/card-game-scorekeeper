-- 修改 players 表 balance 为 NUMERIC(18, 2)
ALTER TABLE players
ALTER COLUMN balance TYPE NUMERIC(18, 2)
USING balance::NUMERIC(18, 2);

-- 修改 transactions 表 amount 为 NUMERIC(18, 2)
ALTER TABLE transactions
ALTER COLUMN amount TYPE NUMERIC(18, 2)
USING amount::NUMERIC(18, 2);
