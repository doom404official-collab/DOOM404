// Signature discovery alone does not establish the cause of reserve movements.
export function summarizePoolSignatures(signatures=[],limit=50) {
 if(!Array.isArray(signatures))throw Error("INVALID_SIGNATURES");
 const observed=signatures.slice(0,limit).filter(s=>typeof s?.signature==="string");
 return {
  signatures:observed.map(s=>({signature:s.signature,slot:s.slot??null,blockTime:s.blockTime??null,err:s.err??null})),
  observedCount:observed.length,
  historyExhausted:false,
  swapsVerified:0,
  depositsVerified:0,
  withdrawalsVerified:0,
  reserveMovementAttributed:false,
  classificationStatus:"pending_transaction_decode"
 };
}
