# Creator checkpoint retention guard

The historical worker retains at most 5,000 entries in each durable acquisition,
movement, transfer-direction, processed-signature and pending-signature collection.
Discovery pauses while the pending backlog has insufficient room for another
300-signature discovery batch. It resumes after processing makes room.

If a proposed checkpoint exceeds a limit, the entire batch is rejected: the prior
cursor and evidence remain saved, and `creatorRetentionBlocked` persists with
`recoveryRequired: true`. Subsequent ticks do not make RPC requests or clear the
gate. History, acquisition-ledger and selling-window eligibility remain false.
This is an explicit capacity blocker, not proof that the missing history is empty.

A pre-guard checkpoint already at the 5,000-entry boundary might have silently
lost entries under the old implementation. It is conservatively blocked as
`LEGACY_RETENTION_INTEGRITY_UNPROVEN`, even if it happens to be intact.

Recovery is deliberately not automatic. Preserve the original checkpoint for
review. A separately reviewed replay or restored checkpoint must establish that
all signatures and evidence are retained before removing the recovery marker.
Simply toggling a flag, truncating arrays or resetting the cursor is not recovery.
A history that cannot fit this bounded format requires a separately approved
storage design; this patch neither changes the database nor grows storage without
bounds. No recovery/migration command or destructive reset is included.

The existing job lease contract remains unchanged. Already-complete jobs that
cannot be leased, and failed jobs returned early by the worker, are not repaired
in storage by this patch. Existing cached outputs require separate review/replay;
this guard does not certify or migrate historical persisted results.
