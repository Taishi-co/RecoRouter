CREATE TABLE IF NOT EXISTS mall_home_sections (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  section_type text NOT NULL,
  title text NOT NULL,
  subtitle text,
  content text,
  image_url text,
  link_type text NOT NULL DEFAULT 'none',
  link_target text,
  product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_home_sections_type_status_idx
  ON mall_home_sections (section_type, status, sort_order ASC, created_at DESC);

CREATE OR REPLACE FUNCTION home_section_json(section mall_home_sections)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', section.id,
    'sectionType', section.section_type,
    'title', section.title,
    'subtitle', section.subtitle,
    'content', section.content,
    'imageUrl', section.image_url,
    'linkType', section.link_type,
    'linkTarget', section.link_target,
    'productIds', section.product_ids,
    'rules', section.rules,
    'sortOrder', section.sort_order,
    'status', section.status,
    'startsAt', section.starts_at,
    'endsAt', section.ends_at,
    'createdAt', section.created_at,
    'updatedAt', section.updated_at
  )
$$;

INSERT INTO mall_home_banners (
  id, title, subtitle, image_url, link_type, link_target, sort_order, status, metadata
)
VALUES
  ('home-banner-opening-promo', '开业大促', '社区鲜品低至 8.8 折', 'mall-products/kiwi.jpeg', 'search', '开业大促', 1, 'active', jsonb_build_object('tag', '今日主推')),
  ('home-banner-full-reduction', '满减活动', '满 49 减 6，可叠加积分', 'mall-products/fresh-milk.jpeg', 'search', '满减', 2, 'active', jsonb_build_object('tag', '省钱优先')),
  ('home-banner-new-launch', '新品首发', '每日上新 10-15 款，节日福利同步上线', 'mall-products/fresh-milk.jpeg', 'search', '新品', 3, 'active', jsonb_build_object('tag', '今日刚到')),
  ('home-banner-festival-benefits', '节日福利', '家庭量贩组合限时上新', 'mall-products/kiwi.jpeg', 'search', '节日福利', 4, 'active', jsonb_build_object('tag', '限时福利'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO mall_home_sections (
  id, section_type, title, subtitle, content, link_type, link_target, product_ids, rules, sort_order, status
)
VALUES
  ('home-notice-arrival', 'announcement', '今日到货提醒', NULL, '草莓、鲜奶、鸡蛋 16:00 后可提', 'search', '今日到货', '[]'::jsonb, jsonb_build_object('audience', 'all'), 10, 'active'),
  ('home-notice-delivery', 'announcement', '配送时效调整', NULL, '晚 6 点场预计 20:30 前到点', 'none', NULL, '[]'::jsonb, jsonb_build_object('audience', 'all'), 20, 'active'),
  ('home-notice-after-sales', 'announcement', '售后通知', NULL, '坏果、破损支持订单内一键申请', 'none', NULL, '[]'::jsonb, jsonb_build_object('audience', 'all'), 30, 'active'),
  ('home-notice-leader', 'announcement', '团长招募', NULL, '自提点订单可享 8%-12% 佣金', 'url', '/pages/mall/group-leader/index', '[]'::jsonb, jsonb_build_object('audience', 'all'), 40, 'active'),
  (
    'home-section-flash-sale',
    'flash_sale',
    '秒杀专区',
    '早 8 点 / 晚 6 点，每日两场',
    NULL,
    'search',
    '秒杀',
    '[]'::jsonb,
    jsonb_build_object('sessions', jsonb_build_array(8, 18), 'displayLimit', 2, 'autoPick', 'tag_or_low_stock', 'tagKeywords', jsonb_build_array('秒杀', '特价', '爆款')),
    10,
    'active'
  ),
  (
    'home-section-new-arrivals',
    'new_arrival',
    '新上专区',
    '每日上新 10-15 款',
    '今日刚到',
    'search',
    '新品',
    '[]'::jsonb,
    jsonb_build_object('displayLimit', 6, 'autoPick', 'tag', 'tagKeywords', jsonb_build_array('今日', '新品', '新上', '现货'), 'badge', '今日刚到'),
    20,
    'active'
  ),
  (
    'home-section-hot-products',
    'best_seller',
    '爆款推荐',
    '平台销量 TOP10 自动更新',
    'TOP10',
    'search',
    '爆款',
    '[]'::jsonb,
    jsonb_build_object('displayLimit', 10, 'autoPick', 'sold_count', 'badgePrefix', 'TOP'),
    30,
    'active'
  )
ON CONFLICT (id) DO NOTHING;
