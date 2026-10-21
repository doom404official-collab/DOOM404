import {randomUUID} from "node:crypto";
import {extractDirectHolderTransfers} from "./directHolderTransfers.mjs";
import {extractHolderNetworkTransfers} from "./holderNetworkTransfers.mjs";
/** Process bounded evidence records; persist results without exposing RPC credentials. */
export async function processEvidenceBatch({jobId,checkpoint,store,rpc,limit=6}={}){
 if(!jobId||!checkpoint||!store||typeof rpc!=="function")throw Error("INVALID_EVIDENCE_JOB");
 if(!Number.isInteger(limit)||limit<1||limit>6)throw Error("INVALID_LIMIT");
 const signatures=[...new Set(Object.values(checkpoint.edges||{}).flatMap(e=>e.signatures||[]))];
 let seeded=0;
 try{seeded=await store.seed(jobId);}catch(error){throw Error("EVIDENCE_SEED_FAILED",{cause:error});}
 if(!Number.isSafeInteger(seeded)||seeded<0)throw Error("EVIDENCE_SEED_INVALID_RESPONSE");
 const workerId=randomUUID();
 let pending;
 try{pending=await store.claim(jobId,workerId,limit);}catch(error){throw Error("EVIDENCE_CLAIM_FAILED",{cause:error});}
 if(!Array.isArray(pending)||pending.length>limit||pending.some(item=>
  !item||typeof item!=="object"||Array.isArray(item)||typeof item.signature!=="string"||!item.signature.trim()||
  !Number.isInteger(item.attempts)||item.attempts<0||item.attempts>=5||
  (Object.hasOwn(item,"job_id")&&item.job_id!==jobId))||
  new Set(pending.map(item=>item.signature)).size!==pending.length)throw Error("EVIDENCE_CLAIM_INVALID_RESPONSE");
 const holders=Object.keys(checkpoint.wallets||{});
 let processed=0,leaseLost=0;
 for(const item of pending){
  let status="unavailable",evidence={reason:"RPC_UNAVAILABLE"};
  try{
   const tx=await rpc("getTransaction",[item.signature,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:1}]);
   if(tx){
    const transfers=extractDirectHolderTransfers({transaction:tx,signature:item.signature,
     holderWallets:holders,tokenAccounts:checkpoint.holders||[]});
    status=transfers.length?"verified":"rejected";
    evidence={reason:transfers.length?"DIRECT_TRANSFER_PROVEN":"NO_DIRECT_HOLDER_TRANSFER",
     pairs:transfers.map(t=>t.participants.join("|")),kinds:[...new Set(transfers.map(t=>t.kind))],slot:tx.slot};
    // Reuse this exact RPC response for independent network extraction. Keep the
    // legacy validation outcome unchanged; do not promote incomplete evidence.
    try{
     const network=extractHolderNetworkTransfers({transaction:tx,signature:item.signature});
     evidence.networkExtraction={version:1,valid:network.valid===true,
      unresolvedTokenTransfers:network.unresolvedTokenTransfers??0,
      unresolvedReasons:network.unresolvedReasons??{},
      transfers:network.valid===true?network.transfers:[],
      ...(network.valid===true?{}:{reason:network.reason??"NETWORK_EVIDENCE_UNAVAILABLE"})};
    }catch{
     // Optional network extraction must never invalidate proven legacy evidence.
     evidence.networkExtraction={version:1,valid:false,unresolvedTokenTransfers:0,
      transfers:[],reason:"NETWORK_EXTRACTION_ERROR"};
    }
   }
  }catch{evidence={reason:"RPC_RETRYABLE_ERROR"};}
  let saved;
  try{saved=await store.finish(jobId,item.signature,workerId,{status,evidence,attempts:item.attempts+1});}
  catch(error){throw Error("EVIDENCE_FINISH_FAILED",{cause:error});}
  if(saved===true)processed++;
  else if(saved===false)leaseLost++;
  else throw Error("EVIDENCE_FINISH_INVALID_RESPONSE");
 }
 return {processed,claimed:pending.length,leaseLost,seeded,queuedSignatures:signatures.length};
}
