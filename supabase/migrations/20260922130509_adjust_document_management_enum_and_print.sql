/*
# GED — Adjustments: enum rename + print_allowed on document_types

## Changes
1. Rename enum value 'aprovacao' → 'aprovado' in document_status type.
2. Add `print_allowed` boolean column to document_types (default true) — defines whether normal users can print documents of that type.
3. Backfill print_allowed on document_types from existing documents.print_allowed where applicable.

## Security
- No policy changes. Existing RLS remains in effect.
*/

-- Rename enum value
ALTER TYPE public.document_status RENAME VALUE 'aprovacao' TO 'aprovado';

-- Add print_allowed to document_types
ALTER TABLE public.document_types
  ADD COLUMN IF NOT EXISTS print_allowed boolean NOT NULL DEFAULT true;
