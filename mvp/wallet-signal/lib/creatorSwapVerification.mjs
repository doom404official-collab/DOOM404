/** Strict adapter boundary for protocol-specific, independently decoded swap sales.
 * No generic token outflow, parsed transfer, or balance delta can satisfy this gate.
 */
export function verifyCreatorSwapSale({mint,creator,signature,transaction,decoder}={}){
 if(typeof decoder!=='function'||!transaction||typeof signature!=='string')throw Error('INVALID_SWAP_VERIFICATION_INPUT');
 if(transaction.meta?.err!=null)return {status:'REJECTED',reason:'FAILED_TRANSACTION'};
 let decoded;
 try{decoded=decoder({mint,creator,signature,transaction});}catch{return {status:'UNVERIFIED',reason:'DECODER_ERROR'};}
 if(!decoded||decoded.kind!=='SWAP_SELL'||decoded.protocolVerified!==true||
    decoded.inputMint!==mint||decoded.seller!==creator||decoded.signature!==signature||
    !Number.isSafeInteger(decoded.timestamp)||decoded.timestamp<=0||
    !/^[0-9]+$/.test(String(decoded.soldRaw))||BigInt(decoded.soldRaw)<=0n||
    typeof decoded.programId!=='string'||!decoded.decoderVersion||
    decoded.instructionVerified!==true||decoded.outputAssetVerified!==true)
  return {status:'UNVERIFIED',reason:'INSUFFICIENT_SWAP_EVIDENCE'};
 return {status:'VERIFIED',sale:{signature,kind:'VERIFIED_SWAP_SELL',independentlyVerified:true,
  inputMintVerified:true,timestamp:decoded.timestamp,soldRaw:String(decoded.soldRaw),
  programId:decoded.programId,decoderVersion:decoded.decoderVersion,outputAsset:decoded.outputAsset}};
}
