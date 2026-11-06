-- Keep the date on which a ticket entered its current status independent of later edits.
ALTER TABLE public.helpdesk_tickets
  ADD COLUMN status_changed_at timestamptz NOT NULL DEFAULT now();

-- Recover the most recent status transition for existing terminal tickets. For
-- records predating the audit trail, use the baseline's first known timestamp.
ALTER TABLE public.helpdesk_tickets DISABLE TRIGGER audit_editable_record;
UPDATE public.helpdesk_tickets AS ticket
SET status_changed_at = coalesce(
  (
    SELECT history.changed_at
    FROM public.edit_history AS history
    WHERE history.entity_name = 'helpdesk_tickets'
      AND history.record_id = ticket.id::text
      AND history.after_data->>'status' = ticket.status
      AND (
        history.action = 'created'
        OR (history.action = 'updated'
          AND history.before_data->>'status' IS DISTINCT FROM history.after_data->>'status')
      )
    ORDER BY history.changed_at DESC, history.id DESC
    LIMIT 1
  ),
  (
    SELECT history.changed_at
    FROM public.edit_history AS history
    WHERE history.entity_name = 'helpdesk_tickets'
      AND history.record_id = ticket.id::text
      AND history.action = 'baseline'
    ORDER BY history.changed_at
    LIMIT 1
  ),
  greatest(ticket.updated_at, ticket.created_at),
  now()
)
WHERE ticket.status IN ('resolvido', 'fechado');
ALTER TABLE public.helpdesk_tickets ENABLE TRIGGER audit_editable_record;

CREATE FUNCTION public.stamp_helpdesk_status_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status_changed_at := now();
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  ELSE
    NEW.status_changed_at := OLD.status_changed_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.stamp_helpdesk_status_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER z_stamp_helpdesk_status_change
  BEFORE INSERT OR UPDATE ON public.helpdesk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.stamp_helpdesk_status_change();

NOTIFY pgrst, 'reload schema';
