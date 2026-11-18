/**
 * Strict creation-instruction verification boundary.
 * A versioned, audited program decoder must be supplied by the caller.
 * No program ID, account position, or discriminator is guessed.
 */
export function verifyLaunchpadCreation({ mint, signature, transaction, decoders = {} } = {}) {
  if (!mint || !signature || !transaction || transaction.meta?.err != null) {
    return { status: "UNRESOLVED", reason: "INVALID_OR_FAILED_TRANSACTION", decodedRoles: [] };
  }
  const keys = (transaction.transaction?.message?.accountKeys || []).map((key) =>
    typeof key === "string" ? key : key?.pubkey
  );
  const outer = transaction.transaction?.message?.instructions || [];
  const inner = (transaction.meta?.innerInstructions || []).flatMap((entry) => entry.instructions || []);
  const verified = [];
  for (const instruction of [...outer, ...inner]) {
    const programId = instruction?.programId || (Number.isInteger(instruction?.programIdIndex) ? keys[instruction.programIdIndex] : null);
    const decoder = Object.hasOwn(decoders, programId) ? decoders[programId] : null;
    if (typeof decoder !== "function") continue;
    // Decoder is trusted only if explicitly registered for the exact program ID.
    // It must validate discriminator, version, account layout, and mint binding.
    let decoded;
    try { decoded = decoder({ instruction, transaction, mint, signature, programId }); }
    catch { continue; }
    if (!decoded || decoded.verified !== true || decoded.mint !== mint ||
        decoded.role !== "launchpad_creator" || typeof decoded.creator !== "string" ||
        !decoded.creator || !decoded.decoderVersion || !decoded.creationInstructionVerified) continue;
    verified.push({
      address: decoded.creator, role: "launchpad_creator", verifiedInstruction: true,
      signature, mint, programId, decoderVersion: decoded.decoderVersion,
    });
  }
  const unique = [...new Set(verified.map((item) => item.address))];
  return {
    status: unique.length === 1 ? "VERIFIED" : "UNRESOLVED",
    reason: unique.length > 1 ? "CONFLICTING_CREATOR_EVIDENCE" : unique.length === 0 ? "NO_VERIFIED_CREATION_INSTRUCTION" : null,
    decodedRoles: unique.length === 1 ? verified : [],
    evidence: verified.map(({ signature, programId, decoderVersion }) => ({ signature, programId, decoderVersion })),
  };
}
