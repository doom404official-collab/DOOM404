/** Evidence-only creator role classifier. Does not discover historical transactions. */
export function classifyCreatorEvidence({ mint, transactions = [] } = {}) {
  if (typeof mint !== "string" || !mint.trim()) throw new TypeError("mint is required");
  const roles = [];
  const warnings = [];
  const seen = new Set();
  for (const candidate of transactions) {
    if (!candidate || candidate.meta?.err != null || candidate.success === false) continue;
    if (candidate.mint !== mint || !candidate.signature || !candidate.programId) continue;
    for (const item of candidate.decodedRoles || []) {
      if (!item || !item.address || !item.role || !item.verifiedInstruction) continue;
      if (!["fee_payer", "initialization_signer", "mint_authority", "metadata_update_authority", "launchpad_creator", "mint_account_creator"].includes(item.role)) continue;
      const key = [candidate.signature, item.role, item.address].join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      roles.push({
        address: item.address,
        role: item.role,
        sourceSignature: candidate.signature,
        programId: candidate.programId,
        verificationMethod: "decoded_instruction",
      });
    }
  }
  const creators = roles.filter((r) => r.role === "launchpad_creator");
  const unique = [...new Set(creators.map((r) => r.address))];
  if (unique.length > 1) warnings.push("Conflicting launchpad creator evidence");
  if (!unique.length) warnings.push("Launchpad creator not established by verified creation instructions");
  return {
    mint,
    status: unique.length === 1 ? "VERIFIED" : roles.length ? "PARTIAL" : "UNRESOLVED",
    launchpad: null,
    roles,
    evidence: roles.map(({ sourceSignature, programId, verificationMethod }) => ({ sourceSignature, programId, verificationMethod })),
    warnings,
  };
}
