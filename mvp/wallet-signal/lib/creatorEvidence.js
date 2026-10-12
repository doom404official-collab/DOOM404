// Attribution evidence is not proof of real-world identity or wallet control.
export function summarizeCreatorEvidence({ creator, mintOrigin } = {}) {
  const claims = [];
  if (creator?.status === "provider_attributed" && creator.address) {
    claims.push({
      kind: "provider_creator", address: creator.address, label: "Provider-attributed creator",
      verification: "provider_reported", source: creator.source || "unknown_provider",
      signature: creator.creationSignature || null,
      limitation: "Provider attribution is not proof of wallet control, beneficial ownership, or original launch authority."
    });
  }
  if (mintOrigin?.status === "initialization_signer_observed") {
    const signers = Array.isArray(mintOrigin.signers) && mintOrigin.signers.length
      ? mintOrigin.signers : mintOrigin.address ? [mintOrigin.address] : [];
    for (const address of [...new Set(signers)].filter(x => typeof x === "string" && x.length)) {
      claims.push({
        kind: "initialization_signer", address, label: "Mint initialization signer",
        verification: mintOrigin.coverage?.initializationVerified === true ? "onchain_observed" : "unverified",
        source: "Solana transaction", signature: mintOrigin.signature || null,
        limitation: "Signing mint initialization does not prove who created, launched, or currently controls the token."
      });
    }
  }
  return {
    status: claims.length ? "evidence_available" : "unverified",
    claims,
    launchPlatform: { status: "not_verified", name: null, reason: "Launch platform and launch creator require independently decoded launch-program instructions." },
    creatorOwnershipVerified: false,
    historicalLaunchesAssessed: false
  };
}
