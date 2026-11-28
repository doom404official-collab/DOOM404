/** Annotate verified events with the actual receipt/source used this pass.
 * Retained events without receipts keep their original provenance; they are
 * never relabelled as freshly retrieved evidence. */
export function retainCreatorEventProvenance(events,{mint,creator,transactions,sources=new Map(),observedAt,attributionBasis}={}){
 return events.map(e=>{
  const tx=transactions.get(e.signature);
  if(e.independentlyVerified!==true||e.instructionVerified!==true||!tx||tx.transaction?.signatures?.[0]!==e.signature||tx.meta?.err!==null||!Number.isSafeInteger(tx.slot)||e.mint!==mint||e.creator!==creator)return e;
  const source=sources.get(e.signature);
  return {...e,slot:tx.slot,decoderVersion:e.decoderVersion||'bounded-creator-proof-pipeline-v10',sourceProvider:source?.provider||e.sourceProvider||'retained_finalized_rpc',verificationStatus:'verified_instruction_and_balance_evidence',evidenceProvenance:{mint,evidenceType:e.type,transactionSignature:e.signature,instructionIdentifier:e.signature+':'+e.instructionIndex+':'+String(e.innerInstructionIndex??'outer'),slot:tx.slot,observedAt,amountRaw:String(e.amountRaw),decoderVersion:e.decoderVersion||'bounded-creator-proof-pipeline-v10',attributionBasis,sourceProvider:source?.provider||e.sourceProvider||'retained_finalized_rpc',sourceMethod:source?.method||'retained_verified_receipt',retrievedThisPass:!!source,historyComplete:false}};
 });
}
