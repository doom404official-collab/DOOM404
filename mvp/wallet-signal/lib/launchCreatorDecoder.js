// Strict launch-creator decoder gate. Only independently reviewed, versioned
// creation schemas may be supplied; no account-index guesses are permitted.
export function decodeLaunchCreator({ mint, instruction, schema } = {}) {
  if (!schema || schema.reviewed !== true || schema.programId !== instruction?.programId ||
      !Array.isArray(schema.discriminator) || schema.discriminator.length !== 8 ||
      !Number.isInteger(schema.mintAccountIndex) || !Number.isInteger(schema.creatorAccountIndex) ||
      schema.mintAccountIndex < 0 || schema.creatorAccountIndex < 0 ||
      schema.mintAccountIndex === schema.creatorAccountIndex) {
    return { status: "unsupported_schema", launchCreator: null, launchCreatorVerified: false };
  }
  const bytes = instruction.dataBytes;
  const accounts = instruction.accounts;
  if (!Array.isArray(bytes) || !Array.isArray(accounts) ||
      !schema.discriminator.every((byte, index) => bytes[index] === byte)) {
    return { status: "instruction_not_matched", launchCreator: null, launchCreatorVerified: false };
  }
  const address = value => typeof value === "string" ? value : value?.toBase58?.() || null;
  if (address(accounts[schema.mintAccountIndex]) !== mint) {
    return { status: "mint_mismatch", launchCreator: null, launchCreatorVerified: false };
  }
  const creator = address(accounts[schema.creatorAccountIndex]);
  if (!creator) return { status: "creator_missing", launchCreator: null, launchCreatorVerified: false };
  return {
    status: "launch_creator_observed", launchCreator: creator,
    launchCreatorVerified: true, // verified only as the role in a reviewed instruction schema
    verificationScope: "onchain_instruction_role",
    schemaVersion: schema.version,
    limitation: "On-chain launch role does not establish beneficial ownership or real-world identity."
  };
}
