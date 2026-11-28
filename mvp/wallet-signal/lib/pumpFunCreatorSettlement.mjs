/** Require independently decoded settlement evidence for Pump.fun creator sale.
 * Never infer a pool payment from net SOL balance changes alone.
 */
export function verifyPumpFunCreatorSettlement({candidate,settlement}={}){
 if(candidate?.status!=='CORROBORATED_CANDIDATE'||candidate.saleVerified!==false||
 !settlement||settlement.independentlyDecoded!==true||
 settlement.signature!==candidate.signature||settlement.creator!==candidate.creator||
 settlement.mint!==candidate.mint||settlement.programId!=='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'||
 settlement.instructionType!=='SELL'||settlement.poolTokenReceiptVerified!==true||
 settlement.creatorSolReceiptVerified!==true||settlement.outputAsset!=='SOL'||
 !/^[0-9]+$/.test(String(settlement.soldRaw))||settlement.soldRaw!==candidate.soldRaw||
 !/^[0-9]+$/.test(String(settlement.creatorReceivedLamports))||
 BigInt(settlement.creatorReceivedLamports)<=0n||!settlement.decoderVersion)
 return {status:'UNVERIFIED',reason:'POOL_SETTLEMENT_EVIDENCE_INCOMPLETE'};
 return {status:'VERIFIED',sale:{signature:candidate.signature,kind:'VERIFIED_SWAP_SELL',
  independentlyVerified:true,inputMintVerified:true,soldRaw:candidate.soldRaw,
  timestamp:settlement.timestamp,programId:settlement.programId,
  decoderVersion:settlement.decoderVersion,outputAsset:'SOL',
  creatorReceivedLamports:String(settlement.creatorReceivedLamports)}};
}
