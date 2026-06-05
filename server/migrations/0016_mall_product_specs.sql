ALTER TABLE IF EXISTS mall_products
  ADD COLUMN IF NOT EXISTS length_cm numeric,
  ADD COLUMN IF NOT EXISTS width_cm numeric,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS volume_liters numeric,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS stock_alert_threshold integer NOT NULL DEFAULT 15;

UPDATE mall_products
SET stock_alert_threshold = 15
WHERE stock_alert_threshold IS NULL;

CREATE INDEX IF NOT EXISTS mall_products_stock_alert_idx
  ON mall_products (stock, stock_alert_threshold, status);

CREATE OR REPLACE FUNCTION product_json(product mall_products, category_name text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', product.id,
    'categoryId', product.category_id,
    'categoryCode', product.category_code,
    'categoryName', category_name,
    'sku', product.sku,
    'name', product.name,
    'subtitle', product.subtitle,
    'description', product.description,
    'imageKey', product.image_url,
    'imageUrl', product.image_url,
    'priceCents', product.price_cents,
    'originalPriceCents', product.original_price_cents,
    'stock', product.stock,
    'stockAlertThreshold', product.stock_alert_threshold,
    'soldCount', product.sold_count,
    'rating', product.rating,
    'status', product.status,
    'tags', product.tags,
    'deliveryMinutes', product.delivery_minutes,
    'coldChainRequired', product.cold_chain_required,
    'lengthCm', product.length_cm,
    'widthCm', product.width_cm,
    'heightCm', product.height_cm,
    'volumeLiters', product.volume_liters,
    'weightKg', product.weight_kg,
    'createdAt', product.created_at,
    'updatedAt', product.updated_at
  )
$$;
