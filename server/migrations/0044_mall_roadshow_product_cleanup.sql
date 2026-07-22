UPDATE mall_products
SET status = 'deleted',
    updated_at = now()
WHERE sku IN ('TEST-GOODS-RECO-DINO')
   OR category_code IN ('goods', 'expired_milk')
   OR name ILIKE '%测试%'
   OR tags::text ILIKE '%测试商品%'
   OR subtitle ILIKE '%测试周边%'
   OR (
    NULLIF(btrim(COALESCE(image_url, '')), '') IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(images) = 'array' THEN images
          ELSE '[]'::jsonb
        END
      ) AS image(value)
      WHERE NULLIF(btrim(image.value), '') IS NOT NULL
    )
  );

WITH sku_cleanup(old_sku, new_sku) AS (
  VALUES
    ('TEST-MILK-DAIRY-FARMERS-1L', 'MILK-DAIRY-FARMERS-1L'),
    ('TEST-FRUIT-KIWI-6', 'FRUIT-KIWI-6'),
    ('TEST-FRUIT-BANANA-BUNCH', 'FRUIT-BANANA-BUNCH'),
    ('TEST-FRUIT-DURIAN-BOX', 'FRUIT-DURIAN-BOX')
)
UPDATE mall_products product
SET sku = sku_cleanup.new_sku,
    updated_at = now()
FROM sku_cleanup
WHERE product.sku = sku_cleanup.old_sku
  AND product.status <> 'deleted'
  AND NOT EXISTS (
    SELECT 1
    FROM mall_products existing
    WHERE existing.sku = sku_cleanup.new_sku
  );

WITH sku_cleanup(old_sku, new_sku) AS (
  VALUES
    ('TEST-MILK-DAIRY-FARMERS-1L', 'MILK-DAIRY-FARMERS-1L'),
    ('TEST-FRUIT-KIWI-6', 'FRUIT-KIWI-6'),
    ('TEST-FRUIT-BANANA-BUNCH', 'FRUIT-BANANA-BUNCH'),
    ('TEST-FRUIT-DURIAN-BOX', 'FRUIT-DURIAN-BOX')
)
UPDATE mall_products product
SET status = 'deleted',
    updated_at = now()
FROM sku_cleanup
WHERE product.sku = sku_cleanup.old_sku
  AND product.status <> 'deleted'
  AND EXISTS (
    SELECT 1
    FROM mall_products existing
    WHERE existing.sku = sku_cleanup.new_sku
  );

UPDATE mall_categories
SET status = 'deleted',
    updated_at = now()
WHERE code IN ('goods', 'expired_milk')
  AND NOT EXISTS (
    SELECT 1
    FROM mall_products product
    WHERE product.category_code = mall_categories.code
      AND product.status <> 'deleted'
  );
