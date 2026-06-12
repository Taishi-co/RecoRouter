CREATE TABLE IF NOT EXISTS mall_procurement_buyers (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  contact_name text,
  contact_phone text,
  license_url text,
  status text NOT NULL DEFAULT 'active',
  remark text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mall_procurement_buyers_status
  ON mall_procurement_buyers (status);

CREATE TABLE IF NOT EXISTS mall_product_buyers (
  product_id text NOT NULL,
  buyer_id text NOT NULL,
  hide_supplier boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_mall_product_buyers_product
  ON mall_product_buyers (product_id);

CREATE INDEX IF NOT EXISTS idx_mall_product_buyers_buyer
  ON mall_product_buyers (buyer_id);

CREATE TABLE IF NOT EXISTS mall_product_qualification_reports (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id text NOT NULL,
  buyer_id text,
  report_name text NOT NULL,
  report_type text,
  report_url text NOT NULL,
  issuer text,
  issued_at text,
  expires_at text,
  hide_supplier boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mall_product_qualification_reports_product
  ON mall_product_qualification_reports (product_id);

CREATE INDEX IF NOT EXISTS idx_mall_product_qualification_reports_buyer
  ON mall_product_qualification_reports (buyer_id);

CREATE INDEX IF NOT EXISTS idx_mall_product_qualification_reports_status
  ON mall_product_qualification_reports (status);

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
    'imageKeys', product.images,
    'images', CASE
      WHEN jsonb_typeof(product.images) = 'array' AND jsonb_array_length(product.images) > 0 THEN product.images
      WHEN product.image_url IS NOT NULL AND btrim(product.image_url) <> '' THEN jsonb_build_array(product.image_url)
      ELSE '[]'::jsonb
    END,
    'variants', CASE
      WHEN jsonb_typeof(product.variants) = 'array' AND jsonb_array_length(product.variants) > 0 THEN product.variants
      ELSE jsonb_build_array(jsonb_build_object(
        'id', 'default',
        'name', COALESCE(NULLIF(product.sale_method, ''), NULLIF(product.specification, ''), '默认规格'),
        'sku', product.sku,
        'specification', COALESCE(NULLIF(product.specification, ''), NULLIF(product.subtitle, ''), '默认规格'),
        'saleMethod', COALESCE(NULLIF(product.sale_method, ''), NULLIF(product.specification, ''), '按份'),
        'priceCents', product.price_cents,
        'originalPriceCents', product.original_price_cents,
        'supplyPriceCents', product.supply_price_cents,
        'stock', product.stock,
        'minimumOrderQuantity', product.minimum_order_quantity,
        'status', product.status,
        'sortOrder', 1
      ))
    END,
    'defaultVariantId', COALESCE(product.variants->0->>'id', 'default'),
    'specification', product.specification,
    'saleMethod', product.sale_method,
    'supplyPriceCents', product.supply_price_cents,
    'priceCents', product.price_cents,
    'originalPriceCents', product.original_price_cents,
    'stock', product.stock,
    'stockAlertThreshold', product.stock_alert_threshold,
    'minimumOrderQuantity', product.minimum_order_quantity,
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
    'qualityGuaranteed', EXISTS (
      SELECT 1
      FROM mall_product_qualification_reports report
      WHERE report.product_id = product.id
        AND report.status = 'active'
        AND btrim(report.report_url) <> ''
    ),
    'procurementBuyers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', buyer.id,
        'name', buyer.name,
        'contactName', buyer.contact_name,
        'contactPhone', buyer.contact_phone,
        'licenseUrl', buyer.license_url,
        'status', buyer.status,
        'remark', buyer.remark,
        'hideSupplier', link.hide_supplier,
        'createdAt', buyer.created_at,
        'updatedAt', buyer.updated_at
      ) ORDER BY buyer.created_at DESC)
      FROM mall_product_buyers link
      JOIN mall_procurement_buyers buyer ON buyer.id = link.buyer_id
      WHERE link.product_id = product.id
        AND buyer.status <> 'deleted'
    ), '[]'::jsonb),
    'qualificationReports', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', report.id,
        'productId', report.product_id,
        'buyerId', report.buyer_id,
        'buyerName', CASE
          WHEN COALESCE(report.hide_supplier, false) OR COALESCE(link.hide_supplier, false) THEN NULL
          ELSE buyer.name
        END,
        'reportName', report.report_name,
        'reportType', report.report_type,
        'reportUrl', report.report_url,
        'issuer', report.issuer,
        'issuedAt', report.issued_at,
        'expiresAt', report.expires_at,
        'hideSupplier', COALESCE(report.hide_supplier, false) OR COALESCE(link.hide_supplier, false),
        'status', report.status,
        'createdAt', report.created_at,
        'updatedAt', report.updated_at
      ) ORDER BY report.created_at DESC)
      FROM mall_product_qualification_reports report
      LEFT JOIN mall_procurement_buyers buyer ON buyer.id = report.buyer_id
      LEFT JOIN mall_product_buyers link
        ON link.product_id = report.product_id
       AND link.buyer_id = report.buyer_id
      WHERE report.product_id = product.id
        AND report.status = 'active'
    ), '[]'::jsonb),
    'createdAt', product.created_at,
    'updatedAt', product.updated_at
  )
$$;
