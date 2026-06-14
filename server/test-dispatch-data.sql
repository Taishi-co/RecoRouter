-- 测试数据：智能调度功能测试
-- 在服务器上执行：psql -U postgres -d recocar -f test-dispatch-data.sql

-- 1. 创建测试用户（如果不存在）
INSERT INTO users (id, name, phone, role, status, credit_score)
VALUES
    ('test-user-1', '测试用户1', '13800138001', 'merchant', 'active', 100),
    ('test-user-2', '测试用户2', '13800138002', 'merchant', 'active', 95),
    ('test-user-3', '测试用户3', '13800138003', 'merchant', 'active', 88)
ON CONFLICT (id) DO NOTHING;

-- 2. 创建测试车主（如果不存在）
INSERT INTO owners (id, name, phone, status, credit_score)
VALUES
    ('test-owner-1', '测试车主1', '13900139001', 'active', 100),
    ('test-owner-2', '测试车主2', '13900139002', 'active', 95)
ON CONFLICT (id) DO NOTHING;

-- 3. 创建测试车辆（如果不存在）
INSERT INTO vehicles (id, vehicle_code, license_plate, vehicle_type, load_capacity, volume, status, trip_status, owner_id)
VALUES
    ('test-vehicle-1', 'V001', '京A12345', '冷链车', 500, 10, 'active', 'idle', 'test-owner-1'),
    ('test-vehicle-2', 'V002', '京B67890', '厢式货车', 800, 15, 'active', 'idle', 'test-owner-1'),
    ('test-vehicle-3', 'V003', '京C11111', '冷链车', 600, 12, 'active', 'idle', 'test-owner-2')
ON CONFLICT (id) DO UPDATE SET
    status = 'active',
    trip_status = 'idle';

-- 4. 创建测试商品（如果不存在）
INSERT INTO mall_products (id, name, category_code, status)
VALUES
    ('test-product-1', '新鲜香蕉', 'fruits', 'active'),
    ('test-product-2', '有机牛奶', 'dairy', 'active'),
    ('test-product-3', '进口车厘子', 'fruits', 'active')
ON CONFLICT (id) DO NOTHING;

-- 5. 创建测试订单（不同时间段）
INSERT INTO mall_orders (id, order_no, user_id, address_text, status, payment_status, payable_cents, delivery_date, delivery_time_slot, created_at)
VALUES
    -- 09:00-10:00 时间段的订单
    ('test-order-1', 'TEST001', 'test-user-1', '北京市朝阳区建国路88号', 'paid', 'paid', 5000, current_date, '09:00-10:00', now() - interval '2 hours'),
    ('test-order-2', 'TEST002', 'test-user-2', '北京市海淀区中关村大街1号', 'paid', 'paid', 8000, current_date, '09:00-10:00', now() - interval '1.5 hours'),
    ('test-order-3', 'TEST003', 'test-user-3', '北京市西城区金融街10号', 'paid', 'paid', 3000, current_date, '09:00-10:00', now() - interval '1 hour'),

    -- 10:00-11:00 时间段的订单
    ('test-order-4', 'TEST004', 'test-user-1', '北京市东城区王府井大街5号', 'paid', 'paid', 12000, current_date, '10:00-11:00', now() - interval '50 minutes'),
    ('test-order-5', 'TEST005', 'test-user-2', '北京市丰台区丽泽商务区', 'paid', 'paid', 6500, current_date, '10:00-11:00', now() - interval '40 minutes'),

    -- 11:00-12:00 时间段的订单
    ('test-order-6', 'TEST006', 'test-user-3', '北京市通州区万达广场', 'paid', 'paid', 4500, current_date, '11:00-12:00', now() - interval '30 minutes'),
    ('test-order-7', 'TEST007', 'test-user-1', '北京市大兴区亦庄开发区', 'paid', 'paid', 9800, current_date, '11:00-12:00', now() - interval '20 minutes'),
    ('test-order-8', 'TEST008', 'test-user-2', '北京市昌平区回龙观', 'paid', 'paid', 7200, current_date, '11:00-12:00', now() - interval '10 minutes'),

    -- 14:00-15:00 时间段的订单
    ('test-order-9', 'TEST009', 'test-user-3', '北京市顺义区空港工业区', 'paid', 'paid', 15000, current_date, '14:00-15:00', now()),
    ('test-order-10', 'TEST010', 'test-user-1', '北京市房山区良乡大学城', 'paid', 'paid', 5500, current_date, '14:00-15:00', now()),

    -- 没有时间段的订单
    ('test-order-11', 'TEST011', 'test-user-2', '北京市石景山区万达广场', 'paid', 'paid', 3800, current_date, NULL, now()),
    ('test-order-12', 'TEST012', 'test-user-3', '北京市门头沟区石门营', 'paid', 'paid', 6200, current_date, NULL, now())
ON CONFLICT (id) DO UPDATE SET
    trip_id = NULL,
    status = 'paid',
    delivery_date = current_date,
    delivery_time_slot = EXCLUDED.delivery_time_slot;

-- 6. 创建订单商品
INSERT INTO mall_order_items (id, order_id, product_id, product_name, quantity, unit_price_cents, line_total_cents)
VALUES
    ('item-1', 'test-order-1', 'test-product-1', '新鲜香蕉', 2, 2500, 5000),
    ('item-2', 'test-order-2', 'test-product-2', '有机牛奶', 4, 2000, 8000),
    ('item-3', 'test-order-3', 'test-product-3', '进口车厘子', 1, 3000, 3000),
    ('item-4', 'test-order-4', 'test-product-1', '新鲜香蕉', 3, 2500, 7500),
    ('item-5', 'test-order-4', 'test-product-2', '有机牛奶', 2, 2000, 4000),
    ('item-6', 'test-order-5', 'test-product-3', '进口车厘子', 2, 3000, 6000),
    ('item-7', 'test-order-6', 'test-product-1', '新鲜香蕉', 1, 2500, 2500),
    ('item-8', 'test-order-6', 'test-product-2', '有机牛奶', 1, 2000, 2000),
    ('item-9', 'test-order-7', 'test-product-3', '进口车厘子', 3, 3000, 9000),
    ('item-10', 'test-order-8', 'test-product-1', '新鲜香蕉', 2, 2500, 5000),
    ('item-11', 'test-order-8', 'test-product-3', '进口车厘子', 1, 3000, 3000),
    ('item-12', 'test-order-9', 'test-product-2', '有机牛奶', 5, 2000, 10000),
    ('item-13', 'test-order-9', 'test-product-1', '新鲜香蕉', 2, 2500, 5000),
    ('item-14', 'test-order-10', 'test-product-3', '进口车厘子', 1, 3000, 3000),
    ('item-15', 'test-order-10', 'test-product-2', '有机牛奶', 1, 2000, 2000),
    ('item-16', 'test-order-11', 'test-product-1', '新鲜香蕉', 1, 2500, 2500),
    ('item-17', 'test-order-11', 'test-product-2', '有机牛奶', 1, 2000, 2000),
    ('item-18', 'test-order-12', 'test-product-3', '进口车厘子', 2, 3000, 6000)
ON CONFLICT DO NOTHING;

-- 查看创建的测试数据
SELECT '=== 测试车辆 ===' as info;
SELECT id, vehicle_code, license_plate, status, trip_status FROM vehicles WHERE id LIKE 'test-vehicle-%';

SELECT '=== 测试订单（按时间段分组）===' as info;
SELECT delivery_time_slot, count(*) as order_count
FROM mall_orders
WHERE id LIKE 'test-order-%'
GROUP BY delivery_time_slot
ORDER BY delivery_time_slot NULLS LAST;

SELECT '=== 测试订单详情 ===' as info;
SELECT order_no, delivery_time_slot, status, trip_id
FROM mall_orders
WHERE id LIKE 'test-order-%'
ORDER BY delivery_time_slot NULLS LAST, created_at;
