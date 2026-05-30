ALTER TABLE platform_settings
  ALTER COLUMN commission_rate SET DEFAULT 0;

UPDATE platform_settings
SET commission_rate = 0,
    updated_at = now()
WHERE id = 'default'
  AND commission_rate = 5;
