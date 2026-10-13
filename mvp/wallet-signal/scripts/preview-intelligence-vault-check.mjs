import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";

/** Preview-only read-only connectivity check; never logs credentials or row contents. */
const allowed = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
const mint = process.env.CREATOR_VALIDATION_MINT || "";
if (!allowed) console.log("INTELLIGENCE_VAULT_CHECK: SKIPPED_NON_TARGET_ENV");
else if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log("INTELLIGENCE_VAULT_CHECK: MISSING_CONFIGURATION");
else {
  try {
    const vault = createIntelligenceVault({
      url: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    const row = await vault.getAttribution(mint);
    console.log("INTELLIGENCE_VAULT_CHECK:", JSON.stringify({
      status: "CONNECTED", tableReadable: true, recordExists: Boolean(row),
      writeAttempted: false,
    }));
  } catch (error) {
    const allowedErrors = new Set(["VAULT_URL_INVALID","VAULT_CREDENTIAL_MISSING",
      "VAULT_AUTH_FAILED","VAULT_RATE_LIMITED","VAULT_REQUEST_FAILED",
      "VAULT_INVALID_RESPONSE","INVALID_MINT"]);
    console.log("INTELLIGENCE_VAULT_CHECK:", JSON.stringify({
      status: "FAILED", reason: allowedErrors.has(error?.message) ? error.message : "NETWORK_OR_UNKNOWN_ERROR",
      writeAttempted: false,
    }));
  }
}
