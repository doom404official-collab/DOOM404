import { createHeliusCreationCandidates } from "../lib/heliusCreationCandidates.mjs";
const mint = process.env.CREATOR_VALIDATION_MINT || "";
const permitted = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
if (!permitted) console.log("HELIUS_INDEX_VALIDATION: SKIPPED_NON_TARGET_ENV");
else if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) console.log("HELIUS_INDEX_VALIDATION: SKIPPED_INVALID_MINT");
else if (!process.env.HELIUS_RPC_URL) console.log("HELIUS_INDEX_VALIDATION: HELIUS_RPC_URL_NOT_CONFIGURED");
else {
  try {
    const provider = createHeliusCreationCandidates({ rpcUrl: process.env.HELIUS_RPC_URL });
    const records = await provider.lookup(mint);
    console.log("HELIUS_INDEX_VALIDATION:", JSON.stringify({
      mint, status: "CANDIDATES_ONLY", count: records.length,
      candidates: records.slice(0,5), creatorVerified: false,
      historyComplete: false, oldestFirstConfirmed: false,
    }));
  } catch (error) {
    const allowed = new Set(["INVALID_HELIUS_ENDPOINT","HELIUS_KEY_NOT_CONFIGURED",
      "HELIUS_INDEX_NETWORK_ERROR","HELIUS_INDEX_AUTH_FAILED","HELIUS_INDEX_RATE_LIMITED",
      "HELIUS_INDEX_HTTP_ERROR","HELIUS_INDEX_INVALID_JSON","HELIUS_INDEX_INVALID_RESPONSE"]);
    console.log("HELIUS_INDEX_VALIDATION:", JSON.stringify({
      mint, status: "UNRESOLVED", reason: allowed.has(error?.message) ? error.message : "HELIUS_INDEX_LOOKUP_FAILED",
    }));
  }
}
