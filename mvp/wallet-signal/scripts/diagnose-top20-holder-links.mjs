import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { summarizeResolvedTokenAccounts } from "../lib/tokenAccountOwnership.js";
import { buildHolderConnectionGraph } from "../lib/holderConnectionGraph.mjs";
import { extractDirectHolderTransfers } from "../lib/directHolderTransfers.mjs";

// Read-only, RPC-ranked top-20 investigation. Not complete wallet history.
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const endpoint=process.env.HELIUS_RPC_URL;
if(!endpoint)throw Error("HELIUS_RPC_URL_NOT_CONFIGURED");
let calls=0,retries=0,last=0;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function rpc(method,params){
 for(let attempt=0;attempt<4;attempt++){
  if(calls>=110)throw Error("REQUEST_BUDGET_EXHAUSTED");
  const delay=Math.max(0,450-(Date.now()-last));if(delay)await wait(delay);last=Date.now();
  const res=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({jsonrpc:"2.0",id:++calls,method,params}),signal:AbortSignal.timeout(15000)});
  if(res.status===429){retries++;if(attempt===3)throw Error("RATE_LIMITED");await wait(1000*2**attempt);continue;}
  if(!res.ok)throw Error("RPC_HTTP_"+res.status);
  const payload=await res.json();if(payload.error)throw Error("RPC_METHOD_"+method+"_ERROR");
  return payload.result;
 }throw Error("RATE_LIMITED");
}
const report={mint,status:"UNRESOLVED",writeAttempted:false,historyComplete:false,commonOwnershipEstablished:false};
try{
 const [largest,supply]=await Promise.all([
  rpc("getTokenLargestAccounts",[mint,{commitment:"confirmed"}]),
  rpc("getTokenSupply",[mint,{commitment:"confirmed"}])
 ]);
 const total=BigInt(supply?.value?.amount||"0");
 if(total<=0n)throw Error("INVALID_SUPPLY");
 const rows=(largest?.value||[]).slice(0,20).map((a,i)=>({
  rank:i+1,tokenAccount:String(a.address),amount:String(a.amount),
  sharePct:Number(BigInt(a.amount)*1000000n/total)/10000
 }));
 if(rows.length!==20)throw Error("INSUFFICIENT_RPC_ACCOUNTS");
 const parsed=[];
 for(const row of rows){
  const result=await rpc("getAccountInfo",[row.tokenAccount,{encoding:"jsonParsed",commitment:"confirmed"}]);
  parsed.push({value:result});
 }
 const owners=summarizeResolvedTokenAccounts(rows,parsed);
 const ownerWallets=[...new Set(owners.accounts.map(x=>x.ownerWallet).filter(Boolean))];
 const observations=[],seenSignatures=new Set();
 let walletHistoriesChecked=0,transactionsChecked=0,failedTransactions=0,interrupted=null;
 for(const wallet of ownerWallets){
  let sigs;
  try{sigs=await rpc("getSignaturesForAddress",[wallet,{limit:3,commitment:"confirmed"}]);}
  catch(e){interrupted=e.message;break;}
  walletHistoriesChecked++;
  for(const entry of sigs||[]){
   if(!entry.signature||entry.err||seenSignatures.has(entry.signature))continue;
   seenSignatures.add(entry.signature);
   try{
    const tx=await rpc("getTransaction",[entry.signature,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:1}]);
    transactionsChecked++;
    observations.push(...extractDirectHolderTransfers({transaction:tx,signature:entry.signature,
      holderWallets:ownerWallets,tokenAccounts:owners.accounts}));
   }catch(e){failedTransactions++;if(e.message==="REQUEST_BUDGET_EXHAUSTED"){interrupted=e.message;break;}}
  }
  if(interrupted)break;
 }
 const holders=owners.observedOwnerGroups;
 const graph=buildHolderConnectionGraph({holders,transactions:observations,historyComplete:false});
 Object.assign(report,{status:interrupted?"PARTIAL_HISTORY_INTERRUPTED":"PARTIAL_HISTORY_OBSERVED",
  top20AccountSharePct:Number(rows.reduce((sum,x)=>sum+BigInt(x.amount),0n)*1000000n/total)/10000,
  top20Accounts:rows.length,ownerWalletsResolved:owners.resolvedAccountCount,
  distinctOwnerWallets:ownerWallets.length,walletHistoriesChecked,transactionsChecked,failedTransactions,
  directConnectionCount:graph.edges.length,connectedWalletCount:graph.connectedWalletCount,
  connectedGroups:graph.connectedGroups,directEdges:graph.edges,
  scannedSignatures:seenSignatures.size,historyPerWalletLimit:3,interrupted,
  requestCount:calls,rateLimitRetries:retries,
  warning:"Only three recent signatures per owner were examined. Zero observed edges does not establish independence."});
}catch(e){report.reason=String(e.message||"DIAGNOSTIC_ERROR");report.requestCount=calls;report.rateLimitRetries=retries;}
console.log(JSON.stringify(report));
