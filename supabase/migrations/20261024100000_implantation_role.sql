-- PostgreSQL requires an enum value to be committed before it can be used.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'implantacao';
