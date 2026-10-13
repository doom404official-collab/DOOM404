-- Private-by-default Intelligence Vault hardening for Supabase Preview.
-- Apply with 001_intelligence_vault.sql in an isolated Preview project.
-- No policies for anon/authenticated: service role alone can access through RLS bypass.
alter table public.token_creator_attributions enable row level security;
alter table public.onchain_transaction_evidence enable row level security;
alter table public.creator_investigation_checkpoints enable row level security;
alter table public.intelligence_source_observations enable row level security;
revoke all on public.token_creator_attributions from anon, authenticated;
revoke all on public.onchain_transaction_evidence from anon, authenticated;
revoke all on public.creator_investigation_checkpoints from anon, authenticated;
revoke all on public.intelligence_source_observations from anon, authenticated;
revoke all on sequence public.intelligence_source_observations_id_seq from anon, authenticated;
-- Keep privileged service credentials server-side. Do not expose in NEXT_PUBLIC_*.
