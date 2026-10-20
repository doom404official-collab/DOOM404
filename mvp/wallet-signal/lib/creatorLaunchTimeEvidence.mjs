/** Launch time evidence must come from a verified creation transaction.
 * Initial attributable allocation is independent and cannot be inferred from current holdings.
 */
export function extractCreatorLaunchTime({transaction,creationSignature,verifiedSignature}={}){
 if(!transaction||creationSignature!==verifiedSignature||
  !Number.isSafeInteger(transaction.blockTime)||transaction.blockTime<=0||
  transaction.meta?.err!=null)return {status:'UNVERIFIED',launchTimestamp:null};
 return {status:'CREATION_TIMESTAMP_VERIFIED',launchTimestamp:transaction.blockTime,
  signature:creationSignature,initialAttributableRaw:null,
  initialAllocationStatus:'NOT_ESTABLISHED'};
}
