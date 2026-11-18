import { verifyLaunchpadCreation } from "./launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "./pumpFunCreation.mjs";

/** Creator-wallet-first, bounded verification near the indexed creation timestamp.
 * A creator is only VERIFIED when a decoded creation instruction matches the mint
 * and the indexed creator. Failed or missing transactions never prove attribution.
 */
export async function verifyIndexedCreatorViaWallet({
  mint, creator, createdTimestamp, lookupSignaturePage, fetchTransaction,
  maxPages = 8, maxTransactions = 40, windowSeconds = 7200,
} = {}) {
  const address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!address.test(mint || "") || !address.test(creator || "")) throw Error("INVALID_ADDRESS");
  if (typeof lookupSignaturePage !== "function" || typeof fetchTransaction !== "function") throw Error("MISSING_RPC");
  if (!Number.isFinite(createdTimestamp) || createdTimestamp <= 0) throw Error("INVALID_TIMESTAMP");
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20 ||
      !Number.isInteger(maxTransactions) || maxTransactions < 1 || maxTransactions > 100) throw Error("INVALID_LIMIT");
  const epoch = createdTimestamp > 1e12 ? Math.floor(createdTimestamp / 1000) : Math.floor(createdTimestamp);
  const minTime = epoch - windowSeconds, maxTime = epoch + windowSeconds;
  let cursor = null, pagesFetched = 0, inspected = 0, retrieved = 0, errors = 0;
  let withinWindow = 0, reachedOlderHistory = false, stoppedAtLimit = false;
  let newerThanWindow = 0, olderThanWindow = 0, missingBlockTime = 0, failedSignature = 0, rawSignaturesSeen = 0, historyExhausted = false;
  const evidence = [], seen = new Set(), candidates = [];
  outer: for (let page = 0; page < maxPages; page++) {
    const batch = await lookupSignaturePage(creator, { before: cursor });
    if (!batch || !Array.isArray(batch.entries)) throw Error("INVALID_SIGNATURE_PAGE");
    pagesFetched++;
    rawSignaturesSeen += batch.entries.length;
    for (const entry of batch.entries) {
      if (!entry?.signature || seen.has(entry.signature)) continue;
      seen.add(entry.signature);
      cursor = entry.signature;
      if (Number.isFinite(entry.blockTime) && entry.blockTime < minTime) {
        olderThanWindow++; reachedOlderHistory = true; break outer;
      }
      if (entry.err != null) { failedSignature++; continue; }
      if (!Number.isFinite(entry.blockTime)) { missingBlockTime++; continue; }
      if (entry.blockTime > maxTime) { newerThanWindow++; continue; }
      if (inspected >= maxTransactions) { stoppedAtLimit = true; break outer; }
      withinWindow++;
      inspected++;
      candidates.push(entry.signature);
      try {
        const tx = await fetchTransaction(entry.signature);
        if (!tx || tx.meta?.err != null) continue;
        retrieved++;
        const proof = verifyLaunchpadCreation({ mint, signature: entry.signature, transaction: tx, decoders: pumpFunDecoders });
        if (proof.status === "VERIFIED" && proof.decodedRoles.some(role => role.address === creator)) {
          evidence.push({ signature: entry.signature, creator, programId: proof.decodedRoles[0].programId,
            decoderVersion: proof.decodedRoles[0].decoderVersion });
        }
      } catch { errors++; }
      if (evidence.length) break outer;
    }
    if (batch.exhausted) { historyExhausted = true; break; }
    if (!batch.nextCursor || batch.nextCursor !== cursor) break;
    if (page === maxPages - 1) stoppedAtLimit = true;
  }
  return {
    mint, indexedCreator: creator, status: evidence.length ? "ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW" : "INDEXED_UNVERIFIED",
    evidence, pagesFetched, inspected, retrieved, errors, withinWindow,
    reachedOlderHistory, historyExhausted, stoppedAtLimit, rawSignaturesSeen,
    newerThanWindow, olderThanWindow, missingBlockTime, failedSignature, nextCursor: cursor,
    creationSignature: evidence[0]?.signature || null,
    candidatesInspected: candidates,
  };
}
