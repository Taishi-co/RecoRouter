-- 清理旧测试数据
DELETE FROM trip_stops WHERE mall_order_id LIKE 'test_order_%';
DELETE FROM vehicle_trips WHERE id IN (
  SELECT DISTINCT t.id FROM vehicle_trips t
  JOIN trip_stops ts ON ts.trip_id = t.id
  WHERE ts.mall_order_id LIKE 'test_order_%'
);
DELETE FROM mall_orders WHERE id LIKE 'test_order_%';
DELETE FROM vehicles WHERE id LIKE 'v_test_%';

-- 测试订单数据（今天及未来6天，共7天）
INSERT INTO mall_orders (id, order_no, user_id, status, payment_status, fulfillment_status, address_text, latitude, longitude, recipient_name, recipient_phone, 
    created_at, updated_at, paid_at, delivery_date, delivery_time_slot) VALUES 
('test_order_001', 'ORD20260621001', 'test_user_001', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区建国路88号SOHO现代城A座1001', 39.9042, 116.4775, '张三', '13800138001', 
    NOW(), NOW(), NOW(), '2026-06-21', '09:00-10:00'),
('test_order_002', 'ORD20260621002', 'test_user_002', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区建国路90号万达广场B座2002', 39.9050, 116.4780, '李四', '13800138002', 
    NOW(), NOW(), NOW(), '2026-06-21', '09:00-10:00'),
('test_order_003', 'ORD20260621003', 'test_user_003', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区建外大街1号国贸中心C座3003', 39.9100, 116.4790, '王五', '13800138003', 
    NOW(), NOW(), NOW(), '2026-06-21', '10:00-11:00'),
('test_order_004', 'ORD20260621004', 'test_user_004', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区光华路8号和乔大厦D座4004', 39.9120, 116.4800, '赵六', '13800138004', 
    NOW(), NOW(), NOW(), '2026-06-21', '10:00-11:00'),
('test_order_005', 'ORD20260621005', 'test_user_005', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区团结湖路10号锦湖园公寓E座5005', 39.9200, 116.4810, '孙七', '13800138005', 
    NOW(), NOW(), NOW(), '2026-06-21', '11:00-12:00'),
('test_order_006', 'ORD20260621006', 'test_user_006', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区农展馆南路13号瑞辰国际中心F座6006', 39.9250, 116.4820, '周八', '13800138006', 
    NOW(), NOW(), NOW(), '2026-06-21', '11:00-12:00'),
('test_order_007', 'ORD20260622007', 'test_user_007', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区望京街9号望京SOHO G座7007', 39.9900, 116.4700, '吴九', '13800138007', 
    NOW(), NOW(), NOW(), '2026-06-22', '14:00-15:00'),
('test_order_008', 'ORD20260622008', 'test_user_008', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区望京北路20号融科橄榄城H座8008', 39.9950, 116.4720, '郑十', '13800138008', 
    NOW(), NOW(), NOW(), '2026-06-22', '14:00-15:00'),
('test_order_009', 'ORD20260622009', 'test_user_009', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区酒仙桥路14号兆维工业园I座9009', 39.9800, 116.4600, '钱十一', '13800138009', 
    NOW(), NOW(), NOW(), '2026-06-22', '15:00-16:00'),
('test_order_010', 'ORD20260623010', 'test_user_010', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区三里屯路19号太古里J座10010', 39.9300, 116.4400, '刘十二', '13800138010', 
    NOW(), NOW(), NOW(), '2026-06-23', '15:00-16:00'),
('test_order_011', 'ORD20260623011', 'test_user_011', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区朝阳公园路6号蓝色港湾K座11011', 39.9350, 116.4500, '陈十三', '13800138011', 
    NOW(), NOW(), NOW(), '2026-06-23', NULL),
('test_order_012', 'ORD20260624012', 'test_user_012', 'paid', 'paid', 'ready_for_pickup', '北京市朝阳区建国门外大街1号SKP L座12012', 39.9150, 116.4650, '杨十四', '13800138012', 
    NOW(), NOW(), NOW(), '2026-06-24', NULL),
('test_order_013', 'ORD20260625013', 'test_user_013', 'paid', 'paid', 'ready_for_pickup', '北京市海淀区中关村大街1号海龙大厦', 39.9800, 116.3100, '朱十五', '13800138013', 
    NOW(), NOW(), NOW(), '2026-06-25', '09:00-10:00'),
('test_order_014', 'ORD20260625014', 'test_user_014', 'paid', 'paid', 'ready_for_pickup', '北京市海淀区知春路甲48号盈都大厦', 39.9750, 116.3200, '秦十六', '13800138014', 
    NOW(), NOW(), NOW(), '2026-06-25', '10:00-11:00'),
('test_order_015', 'ORD20260626015', 'test_user_015', 'paid', 'paid', 'ready_for_pickup', '北京市西城区金融街7号英蓝国际金融中心', 39.9150, 116.3500, '尤十七', '13800138015', 
    NOW(), NOW(), NOW(), '2026-06-26', '14:00-15:00'),
('test_order_016', 'ORD20260627016', 'test_user_016', 'paid', 'paid', 'ready_for_pickup', '北京市东城区王府井大街138号新东安市场', 39.9100, 116.4000, '许十八', '13800138016', 
    NOW(), NOW(), NOW(), '2026-06-27', '11:00-12:00');

-- 测试车辆数据
INSERT INTO vehicles (id, vehicle_code, license_plate, status, trip_status, vehicle_type) VALUES
('v_test_001', 'V001', '京B12345', 'active', 'idle', 'electric'),
('v_test_002', 'V002', '京B23456', 'active', 'idle', 'electric'),
('v_test_003', 'V003', '京B34567', 'active', 'idle', 'electric');

SELECT '已添加测试订单: ' || COUNT(*) FROM mall_orders WHERE id LIKE 'test_order_%';
SELECT '已添加测试车辆: ' || COUNT(*) FROM vehicles WHERE id LIKE 'v_test_%';
SELECT '订单日期分布:';
SELECT delivery_date, COUNT(*) as order_count FROM mall_orders WHERE id LIKE 'test_order_%' GROUP BY delivery_date ORDER BY delivery_date;
