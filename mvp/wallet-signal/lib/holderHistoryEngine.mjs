import {collectWalletSignaturePage} from "./holderHistoryPagination.mjs";
import {recordHistoryPage,recordDecodedTransaction,summarizeHistoryCheckpoint} from "./holderHistoryCheckpoint.mjs";
import {nextHolderScanOrder,advanceHolderScanCursor,holderScanCoverage} from "./holderRoundRobin.mjs";
import {extractDirectHolderTransfers} from "./directHolderTransfers.mjs";
import {buildHolderConnectionGraph} from "./holderConnectionGraph.mjs";

/** Shared history batch for diagnostic and future server-side background workers.
 * The caller owns checkpoint persistence, RPC pacing, budgets, and concurrency.
 */
export async function scanHolderHistoryBatch({checkpoint,rpc,maxRequests=65,pageLimit=10}={}){
 if(!checkpoint||typeof rpc!=="function")throw Error("INVALID_SCAN_INPUT");
 if(!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>500)throw Error("INVALID_REQUEST_BUDGET");
 let used=0,reason=null,decodeAttempts=0,decodeSuccesses=0,discoveryRequests=0;
 const limitedRpc=async(method,params)=>{
  if(used>=maxRequests)throw Error("REQUEST_BUDGET_EXHAUSTED");
  used++;return rpc(method,params);
 };
 const decodePending=async(limit=Infinity)=>{
  let attempted=0;
  for(const [signature,state] of Object.entries(checkpoint.signatures)){
   if(state!=="pending")continue;
   if(attempted>=limit)break;
   attempted++;decodeAttempts++;
   const tx=await limitedRpc("getTransaction",[signature,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:1}]);
   // A temporarily unavailable transaction is retryable. Do not permanently
   // classify it as checked or failed; preserve the pending checkpoint state.
   if(!tx)continue;
   const transfers=extractDirectHolderTransfers({transaction:tx,signature,
    holderWallets:Object.keys(checkpoint.wallets),tokenAccounts:checkpoint.holders});
   recordDecodedTransaction(checkpoint,{signature,transfers});decodeSuccesses++;
  }
 };
 try{
  // Prioritize decoding when a large backlog exists, but reserve one RPC
  // request for forward pagination whenever any wallet remains unexhausted.
  const pendingCount=Object.values(checkpoint.signatures).filter(s=>s==="pending").length;
  const hasUnexhaustedWallet=Object.values(checkpoint.wallets).some(w=>!w.exhausted);
  const reserveForPagination=hasUnexhaustedWallet?1:0;
  const decodeFirst=pendingCount>=pageLimit
   ?Math.max(0,maxRequests-reserveForPagination)
   :Math.max(1,Math.floor(maxRequests/3));
  await decodePending(decodeFirst);
  // Reserve one discovery request when the decode backlog is high.
  // Do not deliberately exceed the bounded worker request budget.
  if(used<maxRequests){
   for(const wallet of nextHolderScanOrder(checkpoint)){
    if(used>=maxRequests)break;
    const page=await collectWalletSignaturePage({wallet,cursor:checkpoint.wallets[wallet].cursor,limit:pageLimit,
     fetchPage:(address,opts)=>limitedRpc("getSignaturesForAddress",[address,{limit:opts.limit,
      ...(opts.before?{before:opts.before}:{}),commitment:"confirmed"}])});
    discoveryRequests++;
    recordHistoryPage(checkpoint,{wallet,page});
    advanceHolderScanCursor(checkpoint,wallet);
    if(pendingCount>=pageLimit)break;
    if(used<maxRequests)await decodePending(maxRequests-used);
   }
  }
 }catch(error){reason=String(error?.message||"SCAN_INTERRUPTED");}
 const observations=[];
 for(const edge of Object.values(checkpoint.edges||{})){
  for(const signature of edge.signatures||[]){
   if(checkpoint.signatures[signature]!=="checked")continue;
   observations.push({signature,confirmed:true,directInteraction:true,participants:[edge.walletA,edge.walletB]});
  }
 }
 const graph=buildHolderConnectionGraph({holders:checkpoint.holders,transactions:observations,historyComplete:false});
 return {checkpoint,summary:{...summarizeHistoryCheckpoint(checkpoint),
  scanCoverage:holderScanCoverage(checkpoint),connectedWallets:graph.connectedWalletCount,
  connectedGroups:graph.connectedGroups,requestCount:used,decodeAttempts,decodeSuccesses,discoveryRequests,reason,
  commonOwnershipEstablished:false,archiveCompletenessProven:false}};
}
