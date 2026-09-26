/*
# Add admin-managed SLA and risk links to notification types

## Summary
Moves the responsibility for linking a notification to an SLA and risk from the collaborator's registration form into the administrator's notification-type configuration.

## Modified Tables
- `notification_types`
  - `sla_id` (uuid, nullable, references `slas`) — the SLA automatically assigned to tickets created with this notification type.
  - `risk_id` (uuid, nullable, references `risks`) — the risk automatically assigned to tickets created with this notification type.

## Security
- The existing shared-data RLS policies on `notification_types` remain unchanged.
- No existing columns or rows are removed or changed.

## Important Notes
1. Both links are optional so existing notification types continue working.
2. Existing ticket links remain untouched.
3. New indexes support the administrator's configuration and workflow lookups.
*/

ALTER TABLE notification_types
  ADD COLUMN IF NOT EXISTS sla_id uuid REFERENCES slas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS risk_id uuid REFERENCES risks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notification_types_sla_id ON notification_types(sla_id);
CREATE INDEX IF NOT EXISTS idx_notification_types_risk_id ON notification_types(risk_id);