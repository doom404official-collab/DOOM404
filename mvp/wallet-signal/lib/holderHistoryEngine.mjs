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
 let used=0,reason=null;
 const limitedRpc=async(method,params)=>{
  if(used>=maxRequests)throw Error("REQUEST_BUDGET_EXHAUSTED");
  used++;return rpc(method,params);
 };
 const decodePending=async()=>{
  for(const [signature,state] of Object.entries(checkpoint.signatures)){
   if(state!=="pending")continue;
   const tx=await limitedRpc("getTransaction",[signature,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:1}]);
   // A temporarily unavailable transaction is retryable. Do not permanently
   // classify it as checked or failed; preserve the pending checkpoint state.
   if(!tx)continue;
   const transfers=extractDirectHolderTransfers({transaction:tx,signature,
    holderWallets:Object.keys(checkpoint.wallets),tokenAccounts:checkpoint.holders});
   recordDecodedTransaction(checkpoint,{signature,transfers});
  }
 };
 try{
  await decodePending();
  for(const wallet of nextHolderScanOrder(checkpoint)){
   advanceHolderScanCursor(checkpoint,wallet);
   const page=await collectWalletSignaturePage({wallet,cursor:checkpoint.wallets[wallet].cursor,limit:pageLimit,
    fetchPage:(address,opts)=>limitedRpc("getSignaturesForAddress",[address,{limit:opts.limit,
     ...(opts.before?{before:opts.before}:{}),commitment:"confirmed"}])});
   recordHistoryPage(checkpoint,{wallet,page});
   await decodePending();
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
  connectedGroups:graph.connectedGroups,requestCount:used,reason,
  commonOwnershipEstablished:false,archiveCompletenessProven:false}};
}
