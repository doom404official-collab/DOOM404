// Pump.fun launch evidence: conservative parser for independently fetched parsed transactions.
// This is not a full Anchor instruction decoder; unknown instruction layouts stay unverified.
export const PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78NQwX9YhMqZ9u4hHtpump";
export function detectPumpLaunch({ mint, transaction, signature } = {}) {
  const message = transaction?.transaction?.message;
  if (!mint || !message || transaction?.meta?.err) return { status: "unverified", reason: "Missing or failed launch transaction" };
  const outer = Array.isArray(message.instructions) ? message.instructions : [];
  const inner = (transaction.meta?.innerInstructions || []).flatMap(group => group.instructions || []);
  const instructions = [...outer, ...inner];
  const pumpInstructions = instructions.filter(ix => {
    const id = typeof ix.programId === "string" ? ix.programId : ix.programId?.toBase58?.();
    return id === PUMP_FUN_PROGRAM;
  });
  if (!pumpInstructions.length) return { status: "not_observed", reason: "Pump.fun program instruction not observed in inspected transaction" };
  const accountKeys = message.accountKeys || [];
  const signers = accountKeys.filter(x => x?.signer && x?.pubkey).map(x => x.pubkey?.toBase58?.() || String(x.pubkey));
  const mintReferenced = instructions.some(ix => {
    const accounts = ix.accounts || [];
    return accounts.some(key => (typeof key === "string" ? key : key?.toBase58?.()) === mint) ||
      ix.parsed?.info?.mint === mint;
  }) || accountKeys.some(x => (x?.pubkey?.toBase58?.() || String(x?.pubkey)) === mint);
  return {
    status: mintReferenced ? "program_interaction_observed" : "unverified",
    platform: "Pump.fun", programId: PUMP_FUN_PROGRAM,
    signature: signature || null, signers: [...new Set(signers)],
    launchCreator: null, launchCreatorVerified: false,
    blockTime: transaction.blockTime ?? null,
    decodingCoverage: { programInteractionObserved: true, mintReferenced, creationInstructionDecoded: false, creatorAccountPositionVerified: false },
    investigation: { instructionCount: pumpInstructions.length, requiresVerifiedProgramIdl: true, requiresCreationInstructionDiscriminator: true },
    reason: mintReferenced
      ? "Pump.fun program interaction and mint reference observed. Launch instruction and creator account have not been independently decoded."
      : "Pump.fun instruction observed, but this mint was not independently linked to the instruction."
  };
}
