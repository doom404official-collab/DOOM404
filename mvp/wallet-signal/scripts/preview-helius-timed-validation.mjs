import { createHeliusTimedHistory } from "../lib/heliusTimedHistory.mjs";
const allowed = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
const mint = process.env.CREATOR_VALIDATION_MINT || "";
const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if (!allowed) console.log("HELIUS_TIMED_VALIDATION: SKIPPED_NON_TARGET_ENV");
else if (!valid.test(mint) || !process.env.HELIUS_RPC_URL)
  console.log("HELIUS_TIMED_VALIDATION: SKIPPED_NOT_CONFIGURED");
else {
  try {
    const response = await fetch("https://frontend-api-v3.pump.fun/coins-v2/" + mint,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error("PUMPFUN_LOOKUP_FAILED");
    const metadata = await response.json();
    if (metadata?.mint !== mint || !Number.isFinite(metadata.created_timestamp)) throw Error("INVALID_PUMPFUN_METADATA");
    const result = await createHeliusTimedHistory({ rpcUrl: process.env.HELIUS_RPC_URL })
      .lookup({ address: mint, createdTimestamp: metadata.created_timestamp, limit: 30 });
    console.log("HELIUS_TIMED_VALIDATION:", JSON.stringify({
      mint, status: "SIGNATURE_CANDIDATES_ONLY", count: result.signatures.length,
      signatures: result.signatures.slice(0, 5), historyComplete: false,
    }));
  } catch (error) {
    const safe = new Set(["HELIUS_TIMED_METHOD_UNAVAILABLE","HELIUS_TIMED_AUTH_FAILED",
      "HELIUS_TIMED_RATE_LIMITED","HELIUS_TIMED_RPC_ERROR","HELIUS_TIMED_INVALID_RESPONSE",
      "HELIUS_TIMED_HTTP_ERROR","HELIUS_TIMED_NETWORK_ERROR","HELIUS_TIMED_INVALID_JSON",
      "PUMPFUN_LOOKUP_FAILED","INVALID_PUMPFUN_METADATA"]);
    console.log("HELIUS_TIMED_VALIDATION:", JSON.stringify({
      mint, status: "UNRESOLVED", reason: safe.has(error?.message) ? error.message : "PROBE_FAILED",
    }));
  }
}
