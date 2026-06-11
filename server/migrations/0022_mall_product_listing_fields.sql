ALTER TABLE IF EXISTS mall_products
  ADD COLUMN IF NOT EXISTS specification text,
  ADD COLUMN IF NOT EXISTS sale_method text;

UPDATE mall_products
SET specification = COALESCE(NULLIF(specification, ''), subtitle)
WHERE specification IS NULL
  AND subtitle IS NOT NULL;

UPDATE mall_products
SET sale_method = COALESCE(NULLIF(sale_method, ''), specification, subtitle)
WHERE sale_method IS NULL
  AND COALESCE(specification, subtitle) IS NOT NULL;

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
    'specification', product.specification,
    'saleMethod', product.sale_method,
    'supplyPriceCents', product.supply_price_cents,
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
