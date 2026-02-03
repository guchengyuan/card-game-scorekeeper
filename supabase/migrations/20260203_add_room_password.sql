ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS password VARCHAR(6);

UPDATE rooms
SET password = '000000'
WHERE password IS NULL;

ALTER TABLE rooms
ALTER COLUMN password SET DEFAULT '000000';

ALTER TABLE rooms
ALTER COLUMN password SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rooms_password_6_digits'
  ) THEN
    ALTER TABLE rooms
    ADD CONSTRAINT rooms_password_6_digits
    CHECK (password ~ '^[0-9]{6}$');
  END IF;
END $$;
