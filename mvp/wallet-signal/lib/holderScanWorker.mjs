import {randomUUID} from "node:crypto";
import {scanHolderHistoryBatch} from "./holderHistoryEngine.mjs";
import {publicHolderScanView} from "./publicHolderScanView.mjs";
/**
 * One bounded worker invocation. Caller provides trusted server-side RPC and
 * service-role store; no client-supplied checkpoint or RPC endpoint.
 */
export async function processHolderScanJob({store,jobId,rpc,maxRequests=35,leaseSeconds=90}={}){
 if(!store||typeof rpc!=="function"||typeof jobId!=="string")throw Error("INVALID_WORKER_INPUT");
 const workerId=randomUUID();
 const claim=await store.claim(jobId,workerId,leaseSeconds);
 if(!claim)return {status:"ALREADY_CLAIMED"};
 // Lease renewal before commit prevents a stale worker from overwriting another.
 const batch=await scanHolderHistoryBatch({checkpoint:claim.checkpoint,rpc,maxRequests,pageLimit:100});
 const renewal=await store.renew(jobId,workerId,claim.version,leaseSeconds);
 if(!renewal)return {status:"LEASE_LOST",requestCount:batch.summary.requestCount};
 const status=batch.summary.providerHistoryExhausted?"complete":"partial";
 const saved=await store.commit(jobId,workerId,renewal.version,batch.checkpoint,batch.summary,status);
 if(!saved)return {status:"VERSION_CONFLICT",requestCount:batch.summary.requestCount};
 return {status:saved.status,version:saved.version,requestCount:batch.summary.requestCount,
  view:publicHolderScanView(batch.checkpoint,{updatedAt:saved.updated_at})};
}
