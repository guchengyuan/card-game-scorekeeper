ALTER TABLE players
ALTER COLUMN balance TYPE BIGINT
USING balance::bigint;

ALTER TABLE transactions
ALTER COLUMN amount TYPE BIGINT
USING amount::bigint;
