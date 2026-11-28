-- Supabase default privileges may grant service_role ALL on newly created tables.
-- Explicitly remove those inherited creation grants before allowing append-only use.
revoke all on public.scanner_qualification_observations from service_role;
grant select,insert on public.scanner_qualification_observations to service_role;
