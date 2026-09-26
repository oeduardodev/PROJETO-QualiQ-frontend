/*
# Delete manually-inserted test users so GoTrue can create them properly

## Problem
Test users were manually inserted into auth.users with PostgreSQL crypt() hashes.
GoTrue can't verify these passwords. We need to delete them so GoTrue can
create fresh users via its signUp endpoint with proper password hashing.
*/

-- Delete identities first (FK constraint)
DELETE FROM auth.identities WHERE user_id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003'
);

-- Delete profiles (FK to auth.users with CASCADE, but explicit is safer)
DELETE FROM profiles WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003'
);

-- Delete the users
DELETE FROM auth.users WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003'
);
