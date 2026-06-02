INSERT INTO mall_categories (code, name, sort_order, status)
VALUES
  ('goods', '周边', 60, 'active')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    updated_at = now();

INSERT INTO mall_products (
  category_id, category_code, sku, name, subtitle, description, image_url,
  price_cents, original_price_cents, stock, sold_count, rating, status, tags,
  delivery_minutes, cold_chain_required, sort_order
)
SELECT c.id, seed.category_code, seed.sku, seed.name, seed.subtitle, seed.description,
       seed.image_url, seed.price_cents, seed.original_price_cents, seed.stock,
       seed.sold_count, seed.rating, seed.status, seed.tags::jsonb,
       seed.delivery_minutes, seed.cold_chain_required, seed.sort_order
FROM (
  VALUES
    ('milk', 'TEST-MILK-DAIRY-FARMERS-1L', 'Dairy Farmers 全脂鲜奶', '1L · 冷藏鲜奶', '适合早餐和家庭补给，冷链温控配送。', '/assets/mall-products/fresh-milk.jpeg', 1280, 1580, 120, 86, 98, 'on_sale', '["冷链","鲜奶","早餐"]', 18, true, 1),
    ('fruit', 'TEST-FRUIT-KIWI-6', '新西兰猕猴桃', '6枚 · 酸甜多汁', '果仓现货，适合拼单加购。', '/assets/mall-products/kiwi.jpeg', 1990, 2380, 95, 132, 97, 'on_sale', '["水果","坏果包赔","现货"]', 18, false, 2),
    ('fruit', 'TEST-FRUIT-BANANA-BUNCH', '精选香蕉', '一把装 · 今日到店', '软糯香甜，适合办公室和家庭补给。', '/assets/mall-products/banana.jpeg', 990, 1290, 140, 210, 96, 'on_sale', '["水果","特价","今日达"]', 18, false, 3),
    ('fruit', 'TEST-FRUIT-DURIAN-BOX', '金枕榴莲果肉', '盒装 · 冷链配送', '开盒即食果肉，冷藏配送到家。', '/assets/mall-products/durian.jpeg', 6990, 7990, 32, 58, 95, 'on_sale', '["榴莲","冷链","高客单"]', 25, true, 4),
    ('goods', 'TEST-GOODS-RECO-DINO', 'RecoRouter 小黄龙玩偶', '测试周边 · 限量款', '用于商城链路测试的周边商品，可与鲜品一同下单。', '/assets/mall-products/reco-dino.jpeg', 3900, 4900, 50, 24, 99, 'on_sale', '["周边","测试商品","限量"]', 30, false, 5)
) AS seed(category_code, sku, name, subtitle, description, image_url, price_cents, original_price_cents, stock, sold_count, rating, status, tags, delivery_minutes, cold_chain_required, sort_order)
JOIN mall_categories c ON c.code = seed.category_code
ON CONFLICT (sku) DO UPDATE
SET category_id = EXCLUDED.category_id,
    category_code = EXCLUDED.category_code,
    name = EXCLUDED.name,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    price_cents = EXCLUDED.price_cents,
    original_price_cents = EXCLUDED.original_price_cents,
    stock = EXCLUDED.stock,
    sold_count = EXCLUDED.sold_count,
    rating = EXCLUDED.rating,
    status = EXCLUDED.status,
    tags = EXCLUDED.tags,
    delivery_minutes = EXCLUDED.delivery_minutes,
    cold_chain_required = EXCLUDED.cold_chain_required,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
