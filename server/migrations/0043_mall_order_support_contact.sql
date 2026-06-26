CREATE OR REPLACE FUNCTION settings_json(settings mall_operation_settings)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', settings.id,
    'freeDeliveryThresholdCents', settings.free_delivery_threshold_cents,
    'defaultDeliveryFeeCents', settings.default_delivery_fee_cents,
    'deliveryPromiseMinutes', settings.delivery_promise_minutes,
    'coldChainEnabled', settings.cold_chain_enabled,
    'refundReviewMinutes', settings.refund_review_minutes,
    'deliveryRules', settings.delivery_rules,
    'supportName', COALESCE(NULLIF(settings.delivery_rules->>'supportName', ''), '叁友甄选客服'),
    'supportPhone', COALESCE(NULLIF(settings.delivery_rules->>'supportPhone', ''), '18888888888'),
    'supportHours', COALESCE(NULLIF(settings.delivery_rules->>'supportHours', ''), '09:00-21:00'),
    'paymentSplitRules', settings.payment_split_rules,
    'roles', settings.roles,
    'riskThresholds', settings.risk_thresholds,
    'updatedAt', settings.updated_at
  )
$$;

CREATE OR REPLACE FUNCTION order_detail_json(mall_order mall_orders)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT order_summary_json(mall_order) || jsonb_build_object(
    'addressId', mall_order.address_id,
    'recipientName', mall_order.recipient_name,
    'recipientPhone', mall_order.recipient_phone,
    'supportName', COALESCE(NULLIF(settings.delivery_rules->>'supportName', ''), '叁友甄选客服'),
    'supportPhone', COALESCE(NULLIF(settings.delivery_rules->>'supportPhone', ''), '18888888888'),
    'supportHours', COALESCE(NULLIF(settings.delivery_rules->>'supportHours', ''), '09:00-21:00'),
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
      SELECT jsonb_agg(mall_after_sale_json(sale) ORDER BY sale.created_at DESC)
      FROM mall_after_sales sale
      WHERE sale.order_id = mall_order.id
    ), '[]'::jsonb)
  )
  FROM (SELECT 1) seed
  LEFT JOIN mall_operation_settings settings ON settings.id = 'default'
$$;
