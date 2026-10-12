import { discoverCreationCandidates } from "./creatorOriginDiscovery.mjs";
import { verifyLaunchpadCreation } from "./launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "./pumpFunCreation.mjs";

/** Resolves only evidence-backed Pump.fun creator roles; does not infer beneficial ownership. */
export async function resolvePumpFunCreator({ mint, lookupSignatures, fetchTransaction, maxCandidates = 100 } = {}) {
  const history = await discoverCreationCandidates({ mint, lookupSignatures, fetchTransaction, maxCandidates });
  const proofs = [];
  for (const { signature, transaction } of history.candidates) {
    const proof = verifyLaunchpadCreation({ mint, signature, transaction, decoders: pumpFunDecoders });
    if (proof.status === "VERIFIED") proofs.push(...proof.decodedRoles);
  }
  const creators = [...new Set(proofs.map((p) => p.address))];
  return {
    mint,
    status: creators.length === 1 ? "VERIFIED" : "UNRESOLVED",
    creator: creators.length === 1 ? creators[0] : null,
    creatorRole: creators.length === 1 ? "launchpad_creator" : null,
    reason: creators.length > 1 ? "CONFLICTING_CREATOR_EVIDENCE" : creators.length === 0 ? "NO_VERIFIED_CREATION_INSTRUCTION" : null,
    evidence: creators.length === 1 ? proofs : [],
    historyComplete: history.complete === true,
    historyWarning: history.reason || null,
    inspected: history.inspected ?? 0,
  };
}
