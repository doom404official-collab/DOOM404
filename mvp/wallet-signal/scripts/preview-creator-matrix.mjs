import { createPumpFunIndexedCreatorProvider } from "../lib/pumpFunIndexedCreatorProvider.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyIndexedCreatorViaWallet } from "../lib/creatorWalletOriginCheck.mjs";

/** Opt-in five-token validation; never substitutes unrelated project tokens.
 * Set CREATOR_MATRIX_MINTS to five distinct, public Pump.fun mints.
 * No provider keys or raw RPC errors are logged.
 */
const allowed = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
const mints = (process.env.CREATOR_MATRIX_MINTS || "").split(",").map(x=>x.trim()).filter(Boolean);
const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if (!allowed) console.log("CREATOR_MATRIX_VALIDATION: SKIPPED_NON_TARGET_ENV");
else if (mints.length !== 5 || new Set(mints).size !== 5 || !mints.every(x=>valid.test(x)))
  console.log("CREATOR_MATRIX_VALIDATION: SKIPPED_NEEDS_FIVE_DISTINCT_MINTS");
else if (!process.env.HELIUS_RPC_URL)
  console.log("CREATOR_MATRIX_VALIDATION: HELIUS_RPC_URL_NOT_CONFIGURED");
else {
  const provider = createPumpFunIndexedCreatorProvider();
  const rpc = createSolanaRpcAdapter({ rpcUrl: process.env.HELIUS_RPC_URL, pageLimit: 100 });
  const results = [];
  for (const mint of mints) {
    try {
      const [record] = await provider.lookup(mint);
      if (!record?.creator || !record?.createdTimestamp) {
        results.push({ mint, status: "UNRESOLVED", reason: "NO_INDEXED_CREATOR" }); continue;
      }
      const check = await verifyIndexedCreatorViaWallet({
        mint, creator: record.creator, createdTimestamp: record.createdTimestamp,
        lookupSignaturePage: rpc.lookupSignaturePage, fetchTransaction: rpc.fetchTransaction,
        maxPages: 5, maxTransactions: 25,
      });
      results.push({ mint, indexedCreator: record.creator, status: check.status,
        creationSignature: check.creationSignature, evidence: check.evidence,
        inspected: check.inspected, errors: check.errors, reachedOlderHistory: check.reachedOlderHistory,
        pagesFetched: check.pagesFetched, rawSignaturesSeen: check.rawSignaturesSeen,
        newerThanWindow: check.newerThanWindow, olderThanWindow: check.olderThanWindow,
        missingBlockTime: check.missingBlockTime, failedSignature: check.failedSignature,
        historyExhausted: check.historyExhausted, stoppedAtLimit: check.stoppedAtLimit });
    } catch {
      results.push({ mint, status: "UNRESOLVED", reason: "PROVIDER_OR_DECODER_ERROR" });
    }
  }
  console.log("CREATOR_MATRIX_VALIDATION:", JSON.stringify({
    total: results.length, onchainMatches: results.filter(x=>x.status==="ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW").length,
    results, independentlyReviewed: false,
  }));
}
