import { createPumpFunIndexedCreatorProvider } from "../lib/pumpFunIndexedCreatorProvider.mjs";
const mint = process.env.CREATOR_VALIDATION_MINT || "";
const allowed = process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
if (!allowed) console.log("PUMPFUN_CREATOR_VALIDATION: SKIPPED_NON_TARGET_ENV");
else if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) console.log("PUMPFUN_CREATOR_VALIDATION: SKIPPED_INVALID_MINT");
else {
  try {
    const records = await createPumpFunIndexedCreatorProvider().lookup(mint);
    console.log("PUMPFUN_CREATOR_VALIDATION:", JSON.stringify({
      mint, status: records.length ? "INDEXED_UNVERIFIED" : "UNRESOLVED",
      candidates: records, creatorVerified: false,
    }));
  } catch (error) {
    const safe = new Set(["PUMPFUN_NETWORK_ERROR","PUMPFUN_ACCESS_DENIED","PUMPFUN_RATE_LIMITED",
      "PUMPFUN_TOKEN_NOT_FOUND","PUMPFUN_HTTP_ERROR","PUMPFUN_INVALID_JSON","PUMPFUN_MINT_MISMATCH"]);
    console.log("PUMPFUN_CREATOR_VALIDATION:", JSON.stringify({
      mint, status: "UNRESOLVED", reason: safe.has(error?.message) ? error.message : "PUMPFUN_LOOKUP_FAILED",
    }));
  }
}
