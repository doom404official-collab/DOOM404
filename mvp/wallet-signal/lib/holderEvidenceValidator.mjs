import {extractDirectHolderTransfers} from "./directHolderTransfers.mjs";

/**
 * Recheck discovered holder edges against independently fetched transaction bodies.
 * No relationship is promoted based solely on checkpoint edges or shared signatures.
 * This module is read-only and deliberately does not assign collusion/ownership.
 */
export async function validateHolderEvidence({checkpoint,rpc,maxRequests=24}={}){
 if(!checkpoint||typeof rpc!=="function"||!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>100)
  throw Error("INVALID_VALIDATION_INPUT");
 const pairs=Object.entries(checkpoint.edges||{}).sort(([a],[b])=>a.localeCompare(b));
 const holders=new Set(Object.keys(checkpoint.wallets||{}));
 const signatureCache=new Map();
 let requests=0;
 const results=[];
 for(const [key,edge] of pairs){
  const a=edge.walletA,b=edge.walletB;
  if(!holders.has(a)||!holders.has(b)||a===b||[a,b].sort().join("|")!==key){
   results.push({pair:key,status:"unverified",strength:"unverified",reason:"INVALID_PAIR",verifiedSignatures:[]});continue;
  }
  const verified=[],rejected=[],unavailable=[];
  for(const sig of [...new Set(edge.signatures||[])]){
   if(typeof sig!=="string"||!sig)continue;
   if(!signatureCache.has(sig)){
    if(requests>=maxRequests){unavailable.push(sig);continue;}
    requests++;
    try{
     const tx=await rpc("getTransaction",[sig,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:1}]);
     signatureCache.set(sig,tx===null?{unavailable:true}:{tx});
    }catch{signatureCache.set(sig,{unavailable:true});}
   }
   const evidence=signatureCache.get(sig);
   if(!evidence||evidence.unavailable){unavailable.push(sig);continue;}
   const transfers=extractDirectHolderTransfers({transaction:evidence.tx,signature:sig,
    holderWallets:[...holders],tokenAccounts:checkpoint.holders||[]});
   if(transfers.some(t=>t.participants.join("|")===key))verified.push(sig);
   else rejected.push(sig);
  }
  const status=verified.length?"verified":unavailable.length?"unverified":"rejected";
  // Repeated direct transfers establish interaction frequency, not coordinated trading.
  const strength=status!=="verified"?status:verified.length>=2?"moderate":"weak";
  results.push({pair:key,walletA:a,walletB:b,status,strength,verifiedSignatures:verified,
   rejectedSignatures:rejected,unavailableSignatures:unavailable,
   reason:status==="verified"?"DIRECT_TRANSFER_PROVEN":status==="rejected"?"NO_DIRECT_TRANSFER":"INSUFFICIENT_EVIDENCE"});
 }
 return {results,requestsUsed:requests,complete:results.every(r=>r.status!=="unverified"&&(r.unavailableSignatures||[]).length===0),
  summary:{pairsReviewed:results.length,verified:results.filter(r=>r.status==="verified").length,
   rejected:results.filter(r=>r.status==="rejected").length,
   unverified:results.filter(r=>r.status==="unverified").length}};
}
