-- Applied through Supabase migration canonical_holder_snapshot_observation_v2.
alter table public.glitch_top20_snapshots add column if not exists observation jsonb;
comment on column public.glitch_top20_snapshots.observation is 'Versioned canonical holder observation with separate context slots, wallet-account mapping, exclusions, hashing and durable artifact provenance. Legacy frozen snapshots remain unchanged.';
