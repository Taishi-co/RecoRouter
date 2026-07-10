ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS read_by TEXT;

CREATE INDEX IF NOT EXISTS support_messages_unread_idx
  ON support_messages (session_id, sender_role, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS support_session_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  from_agent_id TEXT,
  to_agent_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_session_events_session_idx
  ON support_session_events (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_satisfaction_ratings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_satisfaction_ratings_user_idx
  ON support_satisfaction_ratings (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS mall_operations_alerts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dedupe_key TEXT NOT NULL UNIQUE,
  alert_type TEXT NOT NULL,
  source TEXT NOT NULL,
  business_id TEXT,
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved')),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mall_operations_alerts_status_idx
  ON mall_operations_alerts (status, severity, last_occurred_at DESC);

CREATE OR REPLACE FUNCTION support_message_json(message support_messages)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', message.id,
    'sessionId', message.session_id,
    'senderId', message.sender_id,
    'senderRole', message.sender_role,
    'content', message.content,
    'metadata', message.metadata,
    'readAt', message.read_at,
    'readBy', message.read_by,
    'createdAt', message.created_at
  )
$$;
