import {randomUUID} from "node:crypto";
import {extractDirectHolderTransfers} from "./directHolderTransfers.mjs";
/** Process bounded evidence records; persist results without exposing RPC credentials. */
export async function processEvidenceBatch({jobId,checkpoint,store,rpc,limit=6}={}){
 if(!jobId||!checkpoint||!store||typeof rpc!=="function")throw Error("INVALID_EVIDENCE_JOB");
 const signatures=[...new Set(Object.values(checkpoint.edges||{}).flatMap(e=>e.signatures||[]))];
 let seeded=0;
 try{seeded=await store.seed(jobId);}catch(error){throw Error("EVIDENCE_SEED_FAILED",{cause:error});}
 const workerId=randomUUID();
 let pending;
 try{pending=await store.claim(jobId,workerId,limit);}catch(error){throw Error("EVIDENCE_CLAIM_FAILED",{cause:error});}
 if(!Array.isArray(pending))throw Error("EVIDENCE_CLAIM_INVALID_RESPONSE");
 const holders=Object.keys(checkpoint.wallets||{});
 let processed=0;
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
   }
  }catch{evidence={reason:"RPC_RETRYABLE_ERROR"};}
  let saved;
  try{saved=await store.finish(jobId,item.signature,workerId,{status,evidence,attempts:item.attempts+1});}
  catch(error){throw Error("EVIDENCE_FINISH_FAILED",{cause:error});}
  if(saved)processed++;
 }
 return {processed,seeded,queuedSignatures:signatures.length};
}
