import { resolvePumpFunCreatorFromEnvironment } from "../lib/creatorOriginServer.mjs";

// Private, read-only CLI. Run in a trusted server-side environment where
// HELIUS_RPC_URL is configured. Never expose that URL in command output.
const mint = process.argv[2];
if (!mint || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
  console.error("Usage: node scripts/check-creator-origin.mjs <SOLANA_MINT>");
  process.exitCode = 2;
} else {
  try {
    const result = await resolvePumpFunCreatorFromEnvironment({ mint, maxCandidates: 100 });
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "VERIFIED") process.exitCode = 1;
  } catch {
    console.error(JSON.stringify({ status: "UNRESOLVED", reason: "PROVIDER_OR_DECODER_ERROR" }));
    process.exitCode = 1;
  }
}
