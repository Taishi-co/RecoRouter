ALTER TABLE IF EXISTS mall_after_sales
  ADD COLUMN IF NOT EXISTS evidence_images jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS mall_community_posts
  ADD COLUMN IF NOT EXISTS author_user_id text,
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follow_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS join_count integer NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS mall_group_leaders
  ADD COLUMN IF NOT EXISTS user_id text;

CREATE INDEX IF NOT EXISTS mall_group_leaders_user_status_idx
  ON mall_group_leaders (user_id, status);

CREATE TABLE IF NOT EXISTS mall_community_post_interactions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  post_id text NOT NULL,
  user_id text NOT NULL,
  interaction_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_community_post_interactions_uidx
  ON mall_community_post_interactions (post_id, user_id, interaction_type);
CREATE INDEX IF NOT EXISTS mall_community_post_interactions_post_type_idx
  ON mall_community_post_interactions (post_id, interaction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_community_post_interactions_user_idx
  ON mall_community_post_interactions (user_id, created_at DESC);

INSERT INTO mall_group_leaders (pickup_point_id, name, phone, status)
SELECT point.id, point.leader_name, point.leader_phone, point.status
FROM mall_pickup_points point
WHERE point.leader_phone IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE mall_group_leaders leader
SET user_id = app_user.id,
    updated_at = now()
FROM users app_user
WHERE leader.user_id IS NULL
  AND leader.phone IS NOT NULL
  AND app_user.phone = leader.phone;

CREATE OR REPLACE FUNCTION community_post_json(post mall_community_posts)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', post.id,
    'title', post.title,
    'summary', post.summary,
    'content', post.content,
    'imageUrl', post.image_url,
    'images', post.images,
    'authorUserId', post.author_user_id,
    'authorName', post.author_name,
    'pickupPointId', post.pickup_point_id,
    'status', post.status,
    'sortOrder', post.sort_order,
    'likeCount', post.like_count,
    'followCount', post.follow_count,
    'joinCount', post.join_count,
    'createdAt', post.created_at,
    'updatedAt', post.updated_at,
    'pickupPoint', (
      SELECT jsonb_build_object(
        'id', point.id,
        'name', point.name,
        'communityName', point.community_name
      )
      FROM mall_pickup_points point
      WHERE point.id = post.pickup_point_id
    )
  )
$$;

CREATE OR REPLACE FUNCTION order_detail_json(mall_order mall_orders)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT order_summary_json(mall_order) || jsonb_build_object(
    'recipientName', mall_order.recipient_name,
    'recipientPhone', mall_order.recipient_phone,
    'latitude', mall_order.latitude,
    'longitude', mall_order.longitude,
    'remark', mall_order.remark,
    'paidAt', mall_order.paid_at,
    'dispatchedAt', mall_order.dispatched_at,
    'completedAt', mall_order.completed_at,
    'cancelledAt', mall_order.cancelled_at,
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', event.id,
        'stage', event.stage,
        'title', event.title,
        'description', event.description,
        'status', event.status,
        'eventTime', event.event_time,
        'metadata', event.metadata
      ) ORDER BY event.event_time ASC, event.id ASC)
      FROM mall_order_events event
      WHERE event.order_id = mall_order.id
    ), '[]'::jsonb),
    'fulfillmentEvents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', event.id,
        'orderId', event.order_id,
        'fulfillmentCodeId', event.fulfillment_code_id,
        'eventType', event.event_type,
        'title', event.title,
        'description', event.description,
        'metadata', event.metadata,
        'createdAt', event.created_at
      ) ORDER BY event.created_at ASC, event.id ASC)
      FROM mall_fulfillment_events event
      WHERE event.order_id = mall_order.id
    ), '[]'::jsonb),
    'afterSales', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sale.id,
        'reason', sale.reason,
        'description', sale.description,
        'amountCents', sale.amount_cents,
        'evidenceImages', sale.evidence_images,
        'status', sale.status,
        'handlingMethod', sale.handling_method,
        'createdAt', sale.created_at
      ) ORDER BY sale.created_at DESC)
      FROM mall_after_sales sale
      WHERE sale.order_id = mall_order.id
    ), '[]'::jsonb)
  )
$$;
