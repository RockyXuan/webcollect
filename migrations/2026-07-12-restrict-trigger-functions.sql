-- Trigger functions are invoked by their triggers, not through the Data API.
-- Keep execution limited to database-side roles.

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.bump_workspace_version() from public, anon, authenticated;
