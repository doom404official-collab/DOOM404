import { createPumpFunIndexedCreatorProvider } from "../lib/pumpFunIndexedCreatorProvider.mjs";
import { createHeliusTimedHistory } from "../lib/heliusTimedHistory.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";
import { classifyCreatorCandidate } from "../lib/creatorCandidateDiagnostics.mjs";

/** Explicitly invoked, single-mint, low-cost diagnostic. No build-time invocation.
 * The returned reason is diagnostic, not evidence that an indexed creator is wrong.
 */
const mint = process.env.CREATOR_DIAGNOSTIC_MINT;
const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const allowed = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
if (!allowed) console.log("CREATOR_FOCUSED_DIAGNOSTIC: SKIPPED_NON_TARGET_ENV");
else if (!valid.test(mint || "") || !process.env.HELIUS_RPC_URL)
  console.log("CREATOR_FOCUSED_DIAGNOSTIC: SKIPPED_NOT_CONFIGURED");
else {
  const failures = {};
  const classify = e => {
    const code = String(e?.message || "");
    return /^(RPC_|HELIUS_TIMED_)/.test(code) && code.length < 100 ? code : "UNKNOWN_ERROR";
  };
  try {
    const [record] = await createPumpFunIndexedCreatorProvider().lookup(mint);
    if (!record?.creator || !record?.createdTimestamp) throw Error("INDEXED_CREATOR_MISSING");
    const timed = createHeliusTimedHistory({ rpcUrl: process.env.HELIUS_RPC_URL });
    const rpc = createSolanaRpcAdapter({ rpcUrl: process.env.HELIUS_RPC_URL,
      maxRequests: 10, maxRetries: 1, minIntervalMs: 500 });
    const batch = await timed.lookup({ address: mint, createdTimestamp: record.createdTimestamp,
      limit: 10, windowSeconds: 7200 });
    let inspected = 0, matched = null, decodedNonmatch = 0;
    const candidateClasses = {};
    // First five were already checked in the preceding APP diagnostic.
    // Inspect the next five without re-fetching the first five.
    for (const signature of batch.signatures.slice(5, 10)) {
      try {
        const tx = await rpc.fetchTransaction(signature);
        inspected++;
        if (!tx || tx.meta?.err != null) continue;
        const proof = verifyLaunchpadCreation({ mint, signature, transaction: tx, decoders: pumpFunDecoders });
        if(proof.status !== "VERIFIED") { const category=classifyCreatorCandidate(tx,mint); candidateClasses[category]=(candidateClasses[category]||0)+1; }
        const creator = proof.decodedRoles?.[0]?.address;
        if (proof.status === "VERIFIED") {
          if (creator === record.creator) {
            matched = { signature, creator, decoderVersion: proof.decodedRoles[0].decoderVersion };
            break;
          }
          decodedNonmatch++;
        }
      } catch(e) {
        const reason = classify(e);
        failures[reason] = (failures[reason] || 0) + 1;
        if (/RATE_LIMITED|BUDGET_EXHAUSTED|RETRY_AFTER_TOO_LONG/.test(reason)) break;
      }
    }
    console.log("CREATOR_FOCUSED_DIAGNOSTIC:",JSON.stringify({
      mint, indexedCreator: record.creator,
      status: matched ? "ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW" : "INDEXED_UNVERIFIED",
      match: matched, signaturesFound: batch.signatures.length, hasMore: Boolean(batch.paginationToken),
      inspected, candidateOffset: 5, decodedNonmatch, candidateClasses, failures, independentReview: false
    }));
  } catch(e) {
    console.log("CREATOR_FOCUSED_DIAGNOSTIC:",JSON.stringify({
      mint,status:"UNRESOLVED",reason:classify(e)
    }));
  }
}
