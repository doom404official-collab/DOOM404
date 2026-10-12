import { verifyLaunchpadCreation } from "./launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "./pumpFunCreation.mjs";

/**
 * Indexed creator candidate -> on-chain evidence verification.
 * Provider adapters must supply documented, licensed data. No undocumented scraping.
 * Candidate records: { provider, creator, creationSignature, creatorRole }.
 */
export async function resolveIndexedCreator({ mint, providers = [], fetchTransaction } = {}) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint || "")) throw new Error("INVALID_MINT");
  if (typeof fetchTransaction !== "function") throw new Error("FETCH_TRANSACTION_REQUIRED");
  const candidates = [], evidence = [], failures = [];
  for (const provider of providers) {
    if (!provider || typeof provider.lookup !== "function" || !provider.name) continue;
    try {
      const records = await provider.lookup(mint);
      for (const record of Array.isArray(records) ? records.slice(0, 5) : []) {
        if (!record || typeof record.creator !== "string") continue;
        const candidate = {
          provider: provider.name,
          creator: record.creator,
          creatorRole: record.creatorRole || "unspecified",
          creationSignature: record.creationSignature || null,
        };
        candidates.push(candidate);
        if (!candidate.creationSignature) continue;
        try {
          const tx = await fetchTransaction(candidate.creationSignature);
          if (!tx || tx.meta?.err != null) continue;
          const proof = verifyLaunchpadCreation({
            mint, signature: candidate.creationSignature, transaction: tx, decoders: pumpFunDecoders,
          });
          if (proof.status !== "VERIFIED") continue;
          if (!proof.decodedRoles.some(r => r.address === candidate.creator)) continue;
          evidence.push({ ...candidate, programId: proof.decodedRoles[0].programId });
        } catch {
          failures.push({ provider: provider.name, reason: "TRANSACTION_VERIFICATION_FAILED" });
        }
      }
    } catch (error) {
      const allowed = new Set(["SOLSCAN_AUTH_FAILED", "SOLSCAN_RATE_LIMITED", "SOLSCAN_HTTP_ERROR", "SOLSCAN_INVALID_RESPONSE", "SOLSCAN_API_REJECTED", "SOLSCAN_RESPONSE_NOT_JSON", "SOLSCAN_NETWORK_ERROR"]);
      failures.push({ provider: provider.name, reason: allowed.has(error?.message) ? error.message : "INDEX_LOOKUP_FAILED" });
    }
  }
  const creators = [...new Set(evidence.map(e => e.creator))];
  return {
    mint,
    status: creators.length === 1 ? "VERIFIED" : candidates.length ? "INDEXED_UNVERIFIED" : "UNRESOLVED",
    creator: creators.length === 1 ? creators[0] : null,
    evidence: creators.length === 1 ? evidence : [],
    candidates, failures,
    reason: creators.length > 1 ? "CONFLICTING_VERIFIED_CREATORS" : creators.length ? null : "NO_VERIFIED_CREATION_EVIDENCE",
  };
}
