-- Emergency production hotfix (2026-10-09).
-- Profile reads are column-granted. Login queries select whatsapp_opt_in,
-- so this new column must be readable to an authenticated profile owner.
-- Existing profiles RLS still enforces (id = auth.uid()) OR admin.
-- Do not grant table-wide SELECT or grant access to anon.
grant select (whatsapp_opt_in) on table public.profiles to authenticated;
