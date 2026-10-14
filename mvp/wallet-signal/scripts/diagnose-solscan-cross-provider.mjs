import { pathToFileURL } from 'node:url';
import { corroborateCreatorAcrossProviders } from '../lib/crossProviderCreator.mjs';
import { createSolanaRpcAdapter } from '../lib/creatorOriginRpc.mjs';
import { verifyLaunchpadCreation } from '../lib/launchpadCreationVerifier.mjs';
import { pumpFunDecoders } from '../lib/pumpFunCreation.mjs';
export const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
export const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
export const signature='KMoj9pQq8XncaZPHQ5bTNZPDgQwfCBgdihVkxc5Y27fh7iGYwMbti2Mcscprhia1NBJauBbEvs5DE8ooWKWg6bs';
// Fixed destinations; no response bodies, arbitrary provider errors or credentials in logs.
export async function probe(path,params,{apiKey,fetchImpl=fetch}={}) {
 const url=new URL('https://pro-api.solscan.io/v2.0'+path);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 const start=performance.now();
 if(!apiKey)return {summary:{endpoint:path,status:'NOT_CONFIGURED'}};
 try {
  const response=await fetchImpl(url.toString(),{headers:{token:apiKey,accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
  let payload;try{payload=await response.json();}catch{}
  const status=response.ok&&payload?.success===true?'ACCESSIBLE':response.status===429?'RATE_LIMITED':response.status===401?'AUTH_REJECTED':response.status===403?'ACCESS_DENIED':response.ok?'API_REJECTED':'HTTP_ERROR';
  return {summary:{endpoint:path,status,httpStatus:response.status,latencyMs:Math.round(performance.now()-start),retryAfter: /^\d{1,6}$/.test(response.headers?.get('retry-after')||'')?Number(response.headers.get('retry-after')):null},payload};
 }catch{return {summary:{endpoint:path,status:'NETWORK_OR_TIMEOUT',latencyMs:Math.round(performance.now()-start)}};}
}
export async function diagnose({apiKey=process.env.SOLSCAN_API_KEY,rpcUrl=process.env.HELIUS_RPC_URL,fetchImpl=fetch}={}){
 const meta=await probe('/token/meta',{address:mint},{apiKey,fetchImpl});
 // Three sequential calls, no retries, comfortably below the displayed 60 RPM.
 const detail=await probe('/transaction/detail',{tx:signature},{apiKey,fetchImpl});
 const decoded=await probe('/transaction/decoded',{tx:signature},{apiKey,fetchImpl});
 const comparison=await corroborateCreatorAcrossProviders({mint,heliusCreator:creator,heliusSignature:signature,solscanApiKey:apiKey,
 solscanFetch:async()=>({ok:meta.summary.status==='ACCESSIBLE',status:meta.summary.httpStatus,json:async()=>meta.payload})});
 let helius={status:'NOT_CONFIGURED'};
 if(rpcUrl)try{
  const tx=await createSolanaRpcAdapter({rpcUrl,maxRequests:2,maxRetries:0,fetchImpl}).fetchTransaction(signature);
  const result=verifyLaunchpadCreation({mint,signature,transaction:tx,decoders:pumpFunDecoders});
  const address=result.decodedRoles?.[0]?.address;
  helius={status:result.status==='VERIFIED'?'INSTRUCTION_DECODED':result.status,creator:address||null,expectedCreatorMatches:address===creator};
 }catch{helius={status:'RETRIEVAL_FAILED'};}
 // Only independently decode a complete raw RPC-compatible transaction, never Solscan labels/IDL output.
 const tx=detail.payload?.data;
 let independent={status:'RAW_TRANSACTION_NOT_AVAILABLE',independentlyDecoded:false};
 if(detail.summary.status==='ACCESSIBLE'&&tx?.transaction?.signatures?.[0]===signature&&tx?.meta&&Array.isArray(tx.transaction.message?.accountKeys)&&Array.isArray(tx.transaction.message?.instructions)){
  const r=verifyLaunchpadCreation({mint,signature,transaction:tx,decoders:pumpFunDecoders});
  const address=r.decodedRoles?.[0]?.address;
  independent={status:r.status==='VERIFIED'?'SOLSCAN_TRANSACTION_INSTRUCTION_DECODED':r.reason,independentlyDecoded:r.status==='VERIFIED',creator:address||null,creatorMatches:address===creator};
 }
 return {mint,signature,endpoints:[meta.summary,detail.summary,decoded.summary],comparison,helius,independent,
 transactionDetailSignatureMatches:typeof tx?.tx_hash==='string'?tx.tx_hash===signature:null,
 transactionDetailFields:detail.summary.status==='ACCESSIBLE'?Object.keys(tx||{}).filter(k=>/^[a-z_]{1,40}$/.test(k)):[],
 writeAttempted:false,independentlyReviewed:false,evidenceStatus:'ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await diagnose(); console.log(JSON.stringify(result));
 process.exitCode=result.comparison.comparisonStatus==='PROVIDER_AGREEMENT'&&result.helius.expectedCreatorMatches?0:2;
}
