CREATE INDEX IF NOT EXISTS support_sessions_updated_idx
  ON support_sessions (updated_at DESC);

CREATE INDEX IF NOT EXISTS support_sessions_assigned_agent_idx
  ON support_sessions (assigned_agent_id, updated_at DESC)
  WHERE assigned_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS support_messages_session_role_created_idx
  ON support_messages (session_id, sender_role, created_at DESC);
