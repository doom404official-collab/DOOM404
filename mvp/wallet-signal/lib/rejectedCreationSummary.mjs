import { classifyCreatorCandidate } from "./creatorCandidateDiagnostics.mjs";
import { PUMP_PROGRAM_ID } from "./pumpFunCreation.mjs";

/** Summarize rejected creation instruction structure without modifying attribution. */
export function summarizeRejectedCreation({ mint, signature, transaction }) {
  if (classifyCreatorCandidate(transaction, mint) !== "CREATION_DISCRIMINATOR_PRESENT_DECODER_REJECTED") return null;
  const keys=(transaction.transaction?.message?.accountKeys||[]).map(k=>typeof k==="string"?k:k?.pubkey);
  const instructions=[...(transaction.transaction?.message?.instructions||[]),
    ...(transaction.meta?.innerInstructions||[]).flatMap(g=>g.instructions||[])];
  return { signature, category:"CREATION_DISCRIMINATOR_PRESENT_DECODER_REJECTED",
    instructions:instructions.filter(ix=>(ix.programId || keys[ix.programIdIndex])===PUMP_PROGRAM_ID)
      .map(ix=>({accountCount:ix.accounts?.length??0,
        firstAccount:typeof ix.accounts?.[0]==="number"?keys[ix.accounts[0]]:ix.accounts?.[0]??null,
        encodedDataLength:typeof ix.data==="string"?ix.data.length:null})) };
}
