import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createPumpFunIndexedCreatorProvider } from "../lib/pumpFunIndexedCreatorProvider.mjs";

/** Preview-only, opt-in write/read/cache test.
 * No credentials, raw provider responses or full records are logged.
 * Never changes an existing verified attribution.
 */
const mint = process.env.CREATOR_VALIDATION_MINT || "";
const permitted = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e" &&
  process.env.VAULT_SEED_ONCE === "true";
if (!permitted) console.log("INTELLIGENCE_VAULT_SEED: SKIPPED_NOT_OPTED_IN");
else if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log("INTELLIGENCE_VAULT_SEED: MISSING_CONFIGURATION");
else {
  try {
    const vault = createIntelligenceVault({
      url: process.env.SUPABASE_URL, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    let providerCalls = 0;
    const first = await vault.getAttribution(mint);
    if (first) {
      console.log("INTELLIGENCE_VAULT_SEED:", JSON.stringify({
        status: "EXISTING_RECORD", mint, cachedStatus: first.status,
        providerCalls, persisted: true,
      }));
    } else {
      const provider = createPumpFunIndexedCreatorProvider();
      providerCalls++;
      const [record] = await provider.lookup(mint);
      if (!record?.creator || !record.createdTimestamp) throw Error("INDEXED_RECORD_UNAVAILABLE");
      await vault.putIndexedAttribution({
        mint, indexedCreator: record.creator, creationTimestamp: record.createdTimestamp,
      });
      const stored = await vault.getAttribution(mint);
      if (stored?.mint !== mint || stored.indexed_creator !== record.creator ||
          stored.status !== "INDEXED_UNVERIFIED") throw Error("VAULT_READBACK_MISMATCH");
      // Second lookup uses only Supabase, not Pump.fun or Helius.
      const cached = await vault.getAttribution(mint);
      console.log("INTELLIGENCE_VAULT_SEED:", JSON.stringify({
        status: "PERSISTED_AND_READBACK_MATCHED", mint, indexedCreator: cached.indexed_creator,
        cachedStatus: cached.status, providerCalls,
        secondLookupExternalProviderCalls: 0, writeAttempted: true,
      }));
    }
  } catch (error) {
    const safe = new Set(["VAULT_AUTH_FAILED","VAULT_RATE_LIMITED","VAULT_REQUEST_FAILED",
      "VAULT_INVALID_RESPONSE","INDEXED_RECORD_UNAVAILABLE","VAULT_READBACK_MISMATCH",
      "PUMPFUN_ACCESS_DENIED","PUMPFUN_RATE_LIMITED","PUMPFUN_NETWORK_ERROR"]);
    console.log("INTELLIGENCE_VAULT_SEED:", JSON.stringify({
      status: "FAILED", reason: safe.has(error?.message) ? error.message : "SEED_ERROR",
    }));
  }
}
