# Track B — Raydium LaunchLab creator attribution investigation

Status: Research/implementation gate; decoder NOT yet registered.

## Required evidence
- Obtain the official Raydium LaunchLab program ID(s), verified IDL and creation instruction layouts from official source or reproducible on-chain fixtures.
- Identify the launch creator field separately from transaction fee payer, token mint signer, metadata authority, and platform owner.
- Confirm instruction discriminator, account ordering, mint binding, supported versions and any Token-2022 variants.
- Collect at least three successful launch fixtures and negative cases: wrong program, wrong mint, truncated instruction, conflicting creators, failed transaction and unrelated launchpad interaction.
- Decode from original transaction bytes; indexed provider labels only aid discovery.
- Ensure an unsupported version remains UNRESOLVED rather than guessed.
- Run strict unit tests and a read-only historical integration test before adding the decoder to the production registry.

## Independent provider check
- Solscan Free API currently returned 401 for creator and transaction endpoints. Do not assume Pro Lite fixes authorization or provides independent raw decoding.
- Helius on-chain evidence and separate parser agreement are available for the Pump.fun test mint; independent provider/human review remains pending.

## Release gate
Only register LaunchLab decoding after program identity, creator role and real-transaction evidence are established. No Supabase mutation, production deployment, merge, or paid subscription without approval.
