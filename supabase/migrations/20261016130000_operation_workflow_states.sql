ALTER TYPE public.document_status ADD VALUE IF NOT EXISTS 'em_validacao';
ALTER TYPE public.copy_status ADD VALUE IF NOT EXISTS 'aprovada';
ALTER TYPE public.copy_status ADD VALUE IF NOT EXISTS 'recusada';
