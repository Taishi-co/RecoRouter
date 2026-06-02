UPDATE mall_products
SET image_url = regexp_replace(image_url, '^/assets/', '')
WHERE image_url LIKE '/assets/mall-products/%';
