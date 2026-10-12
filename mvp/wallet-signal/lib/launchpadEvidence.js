import { detectPumpLaunch, PUMP_FUN_PROGRAM } from "./pumpLaunchEvidence.js";

// A program ID must be independently verified before adding it here.
// Trading venue identification alone must never be treated as launch attribution.
export const RAYDIUM_LAUNCHLAB_PROGRAM = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
export const RAYDIUM_CLMM_PROGRAM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
function observedRaydiumPrograms(transaction, mint) {
  const message = transaction?.transaction?.message;
  const instructions = [...(message?.instructions || []), ...(transaction?.meta?.innerInstructions || []).flatMap(x => x.instructions || [])];
  const keys = (message?.accountKeys || []).map(x => String(x?.pubkey?.toBase58?.() || x?.pubkey || x));
  const results = [];
  for (const instruction of instructions) {
    const programId = String(instruction?.programId?.toBase58?.() || instruction?.programId || "");
    if (![RAYDIUM_LAUNCHLAB_PROGRAM, RAYDIUM_CLMM_PROGRAM].includes(programId)) continue;
    const accounts = (instruction?.accounts || []).map(x => typeof x === "number" ? keys[x] : String(x?.toBase58?.() || x));
    if (!accounts.includes(mint)) continue;
    results.push({ programId, accounts, program: programId === RAYDIUM_LAUNCHLAB_PROGRAM ? "raydium_launchlab" : "raydium_clmm" });
  }
  return results;
}
export const LAUNCHPAD_REGISTRY = Object.freeze([
  { id: "pump_fun", name: "Pump.fun", programIds: [PUMP_FUN_PROGRAM], detector: "pump_interaction_v1", creatorDecoderVerified: false }
]);
export function detectLaunchpadEvidence({ mint, transaction, signature } = {}) {
  const message = transaction?.transaction?.message;
  if (!mint || !message || transaction?.meta?.err) return {
    status: "unverified", platform: null, launchCreator: null, launchCreatorVerified: false,
    reason: "No valid origin transaction available for launchpad attribution."
  };
  const pump = detectPumpLaunch({ mint, transaction, signature });
  if (pump.status === "program_interaction_observed") return {
    ...pump, platformId: "pump_fun", evidenceClass: "onchain_program_interaction",
    platformVerifiedAsLauncher: false
  };
  const raydium = observedRaydiumPrograms(transaction, mint);
  if (raydium.length) return {
    status: "program_interaction_observed", platform: "Raydium", platformId: raydium[0].program,
    launchCreator: null, launchCreatorVerified: false, platformVerifiedAsLauncher: false,
    evidenceClass: "onchain_program_interaction", signature: signature || null,
    programId: raydium[0].programId,
    reason: "Raydium program interaction references the mint; creation instruction and creator role require schema verification."
  };
  return {
    status: "unverified", platform: null, platformId: null, launchCreator: null,
    launchCreatorVerified: false, platformVerifiedAsLauncher: false,
    signature: signature || null,
    reason: "No supported launchpad interaction linked to this mint. A custom or unsupported launch remains possible."
  };
}
