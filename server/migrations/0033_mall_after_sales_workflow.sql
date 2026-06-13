ALTER TABLE IF EXISTS mall_after_sales
  ADD COLUMN IF NOT EXISTS after_sale_type text NOT NULL DEFAULT 'refund_only',
  ADD COLUMN IF NOT EXISTS selected_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS requested_amount_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_amount_cents bigint,
  ADD COLUMN IF NOT EXISTS solution_type text,
  ADD COLUMN IF NOT EXISTS negotiation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS return_logistics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS support_session_id text,
  ADD COLUMN IF NOT EXISTS resolution text,
  ADD COLUMN IF NOT EXISTS timeline jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE mall_after_sales
SET requested_amount_cents = COALESCE(NULLIF(requested_amount_cents, 0), amount_cents),
    approved_amount_cents = CASE
      WHEN approved_amount_cents IS NULL AND status IN ('approved', 'refunding', 'refunded', 'resolved') THEN amount_cents
      ELSE approved_amount_cents
    END,
    solution_type = COALESCE(solution_type, after_sale_type),
    negotiation_status = CASE
      WHEN status IN ('refunded', 'resolved', 'closed') THEN 'agreed'
      WHEN status = 'rejected' THEN 'rejected'
      WHEN status IN ('approved', 'refunding') THEN 'agreed'
      ELSE negotiation_status
    END,
    timeline = CASE
      WHEN jsonb_typeof(timeline) = 'array' AND jsonb_array_length(timeline) > 0 THEN timeline
      ELSE jsonb_build_array(jsonb_build_object(
        'status', status,
        'title', '售后申请已提交',
        'description', COALESCE(description, reason),
        'createdAt', created_at
      ))
    END;

CREATE INDEX IF NOT EXISTS mall_after_sales_type_status_idx
  ON mall_after_sales (after_sale_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS mall_after_sales_support_session_idx
  ON mall_after_sales (support_session_id);

CREATE OR REPLACE FUNCTION mall_after_sale_json(sale mall_after_sales)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', sale.id,
    'orderId', sale.order_id,
    'userId', sale.user_id,
    'afterSaleType', sale.after_sale_type,
    'reason', sale.reason,
    'description', sale.description,
    'selectedItems', sale.selected_items,
    'amountCents', sale.amount_cents,
    'requestedAmountCents', sale.requested_amount_cents,
    'approvedAmountCents', sale.approved_amount_cents,
    'evidenceImages', sale.evidence_images,
    'status', sale.status,
    'handlingMethod', sale.handling_method,
    'solutionType', sale.solution_type,
    'negotiationStatus', sale.negotiation_status,
    'returnLogistics', sale.return_logistics,
    'supportSessionId', sale.support_session_id,
    'resolution', sale.resolution,
    'timeline', sale.timeline,
    'createdAt', sale.created_at,
    'updatedAt', sale.updated_at
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
$$;
