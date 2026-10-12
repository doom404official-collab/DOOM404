// Evidence-first creator origin resolver foundation.
// Unknown schemas never produce verified creator claims.
export const CREATOR_ROLES = Object.freeze([
  "mint_initializer", "transaction_fee_payer", "initialization_signer",
  "mint_authority", "metadata_update_authority", "launchpad_designated_creator"
]);
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PROGRAMS = Object.freeze({
  pumpFun: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  raydiumLaunchLab: "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj"
});
// Registry intentionally empty until official IDL discriminators, account roles,
// and creator argument offsets are audited and pinned to a specific version.
export const AUDITED_CREATOR_SCHEMAS = Object.freeze([]);
export function normalizeOriginTransaction(tx) {
  if (!tx || tx.meta?.err || !tx.transaction?.message) return { status: "invalid_or_failed", instructions: [] };
  const message = tx.transaction.message;
  const staticKeys = (message.accountKeys || message.staticAccountKeys || []).map(k => String(k?.pubkey?.toBase58?.() || k?.pubkey || k?.toBase58?.() || k));
  const lookup = tx.meta?.loadedAddresses || {};
  const keys = [...staticKeys, ...(lookup.writable || []).map(String), ...(lookup.readonly || []).map(String)];
  const normalize = (ix, outerIndex, inner) => {
    const programId = String(ix?.programId?.toBase58?.() || ix?.programId || (Number.isInteger(ix?.programIdIndex) ? keys[ix.programIdIndex] : "") || "");
    const accounts = (ix?.accounts || []).map(a => typeof a === "number" ? keys[a] || null : String(a?.pubkey?.toBase58?.() || a?.pubkey || a?.toBase58?.() || a));
    return { programId, accounts, data: ix?.data || null, parsed: ix?.parsed || null, outerIndex, inner };
  };
  const instructions = (message.instructions || []).map((ix,i) => normalize(ix,i,false));
  for (const group of tx.meta?.innerInstructions || []) {
    for (const ix of group.instructions || []) instructions.push(normalize(ix,group.index,true));
  }
  return { status: "normalized", signature: tx.transaction.signatures?.[0] || null,
    slot: tx.slot ?? null, blockTime: tx.blockTime ?? null, keys, instructions };
}
export function resolveCreatorRole({ mint, transaction, registry = AUDITED_CREATOR_SCHEMAS } = {}) {
  const normalized = normalizeOriginTransaction(transaction);
  if (normalized.status !== "normalized" || !BASE58.test(mint || "")) return { status: "unresolved", reason: "invalid_mint_or_transaction", evidence: null };
  const candidates = [];
  for (const instruction of normalized.instructions) {
    if (!instruction.accounts.includes(mint)) continue;
    const schemas = registry.filter(s => s?.internallyAudited === true && s.programId === instruction.programId && s.version && s.discriminator);
    // Never trust a supplied reviewed flag or guess account positions.
    for (const schema of schemas) {
      if (typeof schema.decode !== "function") continue;
      const result = schema.decode(instruction);
      if (result?.mint !== mint || !BASE58.test(result?.creator || "") || result?.role !== "launchpad_designated_creator") continue;
      candidates.push({ address: result.creator, role: result.role, schemaVersion: schema.version, programId: instruction.programId });
    }
  }
  if (!candidates.length) return { status: "unresolved", reason: "no_audited_creator_instruction", evidence: { signature: normalized.signature, slot: normalized.slot, transactionSuccessful: true } };
  const unique = [...new Set(candidates.map(x=>x.address))];
  if (unique.length !== 1) return { status: "conflict", candidates, evidence: { signature: normalized.signature, slot: normalized.slot } };
  return { status: "verified_role", creator: { address: unique[0], role: "launchpad_designated_creator", beneficialOwnershipVerified: false },
    evidence: { signature: normalized.signature, slot: normalized.slot, programId: candidates[0].programId, schemaVersion: candidates[0].schemaVersion }, historyComplete: false };
}
