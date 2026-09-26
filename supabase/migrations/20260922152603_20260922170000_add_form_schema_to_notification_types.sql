/*
# Add form_schema column to notification_types

## Summary
Adds a `form_schema` JSONB column to the `notification_types` table.
This column stores the dynamic form field definitions (e.g. classification,
subclassification fields) that each notification type requires from the
collaborator when registering an incident.

## Changes
1. New column on `notification_types`:
   - `form_schema` (jsonb, nullable) — array of field definitions:
     { name: string, type: 'text'|'number'|'date'|'select', label: string, required?: boolean, options?: string[] }

## Notes
1. The existing `custom_fields_schema` column is kept for backward compatibility.
2. `form_schema` is the new dedicated structure for the form builder feature.
3. RLS policies already exist on notification_types and remain unchanged.
*/

ALTER TABLE notification_types
  ADD COLUMN IF NOT EXISTS form_schema jsonb;
