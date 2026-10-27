import {extractHolderNetworkTransfers} from './holderNetworkTransfers.mjs';
import {collectWalletSignaturePage} from "./holderHistoryPagination.mjs";
import {recordHistoryPage,recordDecodedTransaction,summarizeHistoryCheckpoint} from "./holderHistoryCheckpoint.mjs";
import {nextHolderScanOrder,advanceHolderScanCursor,holderScanCoverage} from "./holderRoundRobin.mjs";
import {extractDirectHolderTransfers} from "./directHolderTransfers.mjs";
import {recordHolderNetworkTransaction,holderNetworkSnapshotIdentity,NETWORK_RETENTION_LIMITS} from "./holderNetworkCheckpoint.mjs";
import {buildHolderConnectionGraph} from "./holderConnectionGraph.mjs";

/** Shared history batch for diagnostic and future server-side background workers.
 * The caller owns checkpoint persistence, RPC pacing, budgets, and concurrency.
 */
export async function scanHolderHistoryBatch({checkpoint,rpc,maxRequests=65,pageLimit=10}={}){
 if(!checkpoint||typeof rpc!=="function")throw Error("INVALID_SCAN_INPUT");
 if(!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>500)throw Error("INVALID_REQUEST_BUDGET");
 let used=0,reason=null,decodeAttempts=0,decodeSuccesses=0,discoveryRequests=0,decodeUnavailable=0,decodeUnverified=0,decodeUnresolved=0;
 const attemptedThisBatch=new Set();
 const limitedRpc=async(method,params)=>{
  if(used>=maxRequests)throw Error("REQUEST_BUDGET_EXHAUSTED");
  used++;return rpc(method,params);
 };
 const decodePending=async(limit=Infinity)=>{
  let attempted=0;
  const keys=Object.keys(checkpoint.signatures);
  const next=keys.indexOf(checkpoint.lastDecodeAttemptSignature)+1;
  const ordered=[...keys.slice(next),...keys.slice(0,next)];
  for(const signature of ordered){
   if(checkpoint.signatures[signature]!=="pending"||attemptedThisBatch.has(signature))continue;
   if(attempted>=limit)break;
   if(used>=maxRequests)break;
   attempted++;decodeAttempts++;attemptedThisBatch.add(signature);
   checkpoint.lastDecodeAttemptSignature=signature;
   const tx=await limitedRpc("getTransaction",[signature,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:1}]);
   // A temporarily unavailable transaction is retryable. Do not permanently
   // classify it as checked or failed; preserve the pending checkpoint state.
   if(tx===null){decodeUnavailable++;continue;}
   // Reuse the existing envelope/identity decoder before marking anything checked.
   // Unavailable, malformed or wrong-signature responses remain unresolved.
   if(tx?.version!==undefined&&!['legacy',0,1].includes(tx.version)){decodeUnverified++;continue;}
   const instruction=ix=>ix!==null&&typeof ix==='object'&&!Array.isArray(ix)&&typeof ix.programId==='string'&&ix.programId.length>0;
   const message=tx?.transaction?.message;
   if(Array.isArray(message?.instructions)&&message.instructions.some(ix=>!instruction(ix))||Array.isArray(tx?.meta?.innerInstructions)&&tx.meta.innerInstructions.some(group=>Array.isArray(group?.instructions)&&group.instructions.some(ix=>!instruction(ix)))){decodeUnverified++;continue;}
   const parsed=extractHolderNetworkTransfers({transaction:tx,signature});
   if(!parsed.valid){decodeUnverified++;continue;}
   if(parsed.transfers.length>NETWORK_RETENTION_LIMITS.transfers)throw Error('NETWORK_RETENTION_LIMIT');
   const evidence=checkpoint.networkEvidence;
   if(evidence){
    if(evidence.version!==1||evidence.snapshotIdentity!==holderNetworkSnapshotIdentity(checkpoint)||!evidence.processed||typeof evidence.processed!=='object'||Array.isArray(evidence.processed)||!Array.isArray(evidence.transfers))throw Error('NETWORK_EVIDENCE_INCOMPATIBLE');
    if(Object.hasOwn(evidence.processed,signature))throw Error('NETWORK_EVIDENCE_STATE_CONFLICT');
    if(evidence.retentionLimited!==false||Object.keys(evidence.processed).length>=NETWORK_RETENTION_LIMITS.signatures||evidence.transfers.length+parsed.transfers.length>NETWORK_RETENTION_LIMITS.transfers)throw Error('NETWORK_RETENTION_LIMIT');
   }
   const transfers=extractDirectHolderTransfers({transaction:tx,signature,
    holderWallets:Object.keys(checkpoint.wallets),tokenAccounts:checkpoint.holders});
   recordDecodedTransaction(checkpoint,{signature,transfers});
   recordHolderNetworkTransaction(checkpoint,{signature,transaction:tx});decodeSuccesses++;
   if(parsed.unresolvedTokenTransfers>0)decodeUnresolved++;
  }
 };
 try{
  // Prioritize decoding when a large backlog exists, but reserve one RPC
  // request for forward pagination whenever any wallet remains unexhausted.
  const pendingCount=Object.values(checkpoint.signatures).filter(s=>s==="pending").length;
  const hasUnexhaustedWallet=Object.values(checkpoint.wallets).some(w=>!w.exhausted);
  // Backlog-heavy jobs get three decoding-only batches, then one pagination batch.
  // The counter is persisted in the existing checkpoint; no new database schema.
  const priorDecodeOnly=Math.max(0,Math.min(3,Number(checkpoint.decodeOnlyBatches)||0));
  const highBacklog=pendingCount>=Math.max(100,pageLimit*2);
  const shouldDiscover=hasUnexhaustedWallet&&(highBacklog?priorDecodeOnly>=3:maxRequests===1&&pendingCount>0?priorDecodeOnly>=1:true);
  const reserveForPagination=shouldDiscover?1:0;
  const decodeFirst=pendingCount>=pageLimit
   ?Math.max(0,maxRequests-reserveForPagination)
   :Math.min(maxRequests-reserveForPagination,Math.max(1,Math.floor(maxRequests/3)));
  await decodePending(decodeFirst);
  // Reserve one discovery request when the decode backlog is high.
  // Do not deliberately exceed the bounded worker request budget.
  if(shouldDiscover&&used<maxRequests){
   for(const wallet of nextHolderScanOrder(checkpoint)){
    if(used>=maxRequests)break;
    const page=await collectWalletSignaturePage({wallet,cursor:checkpoint.wallets[wallet].cursor,cursorSlot:checkpoint.wallets[wallet].oldestSlot??null,limit:pageLimit,
     fetchPage:(address,opts)=>limitedRpc("getSignaturesForAddress",[address,{limit:opts.limit,
      ...(opts.before?{before:opts.before}:{}),commitment:"confirmed"}])});
    discoveryRequests++;
    recordHistoryPage(checkpoint,{wallet,page});
    advanceHolderScanCursor(checkpoint,wallet);
    if(pendingCount>=pageLimit)break;
    if(used<maxRequests)await decodePending(maxRequests-used);
   }
  }
  if(pendingCount>0&&hasUnexhaustedWallet){
   checkpoint.decodeOnlyBatches=discoveryRequests>0?0:Math.min(3,priorDecodeOnly+1);
  }else checkpoint.decodeOnlyBatches=0;
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
  connectedGroups:graph.connectedGroups,requestCount:used,decodeAttempts,decodeSuccesses,decodeUnavailable,decodeUnverified,decodeUnresolved,discoveryRequests,decodeOnlyBatches:checkpoint.decodeOnlyBatches??0,reason,
  commonOwnershipEstablished:false,archiveCompletenessProven:false}};
}
