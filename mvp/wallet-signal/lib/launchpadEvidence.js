import { detectPumpLaunch, PUMP_FUN_PROGRAM } from "./pumpLaunchEvidence.js";

// A program ID must be independently verified before adding it here.
// Trading venue identification alone must never be treated as launch attribution.
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
  return {
    status: "unverified", platform: null, platformId: null, launchCreator: null,
    launchCreatorVerified: false, platformVerifiedAsLauncher: false,
    signature: signature || null,
    reason: "No supported launchpad interaction linked to this mint. A custom or unsupported launch remains possible."
  };
}
