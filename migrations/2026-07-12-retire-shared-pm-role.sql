-- Retire the former portfolio-management login after the projects were split.
-- This migration changes privileges only. It does not delete tables, rows, or roles.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'alphalens_app') then
    execute 'alter role alphalens_app nologin';
    execute 'revoke all privileges on all tables in schema public from alphalens_app';
    execute 'revoke all privileges on all sequences in schema public from alphalens_app';
    execute 'revoke all privileges on all functions in schema public from alphalens_app';
    execute 'revoke all privileges on schema public from alphalens_app';
  end if;
end;
$$;
