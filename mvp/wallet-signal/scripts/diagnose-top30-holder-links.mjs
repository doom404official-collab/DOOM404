import { buildHolderConnectionGraph } from "../lib/holderConnectionGraph.mjs";
import { extractDirectHolderTransfers } from "../lib/directHolderTransfers.mjs";

// Bounded read-only investigation; never claims complete chain history.
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const rpcUrl=process.env.HELIUS_RPC_URL;
if(!rpcUrl)throw Error("HELIUS_RPC_URL_NOT_CONFIGURED");
let requests=0,rateLimitRetries=0;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let lastCall=0;
async function rpc(method,params){
 for(let attempt=0;attempt<4;attempt++){
  if(requests>=150)throw Error("REQUEST_BUDGET_EXHAUSTED");
  const wait=Math.max(0,400-(Date.now()-lastCall));
  if(wait)await sleep(wait);
  lastCall=Date.now();
  const id=++requests;
  const response=await fetch(rpcUrl,{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({jsonrpc:"2.0",id,method,params}),signal:AbortSignal.timeout(12000)});
  if(response.status===429){
   rateLimitRetries++;
   if(attempt===3)throw Error("RPC_RATE_LIMIT_EXHAUSTED");
   const raw=response.headers.get("retry-after");
   const seconds=raw&&/^\\d+(?:\\.\\d+)?$/.test(raw)?Number(raw):NaN;
   const delay=Number.isFinite(seconds)?seconds*1000:1000*2**attempt;
   if(delay>15000)throw Error("RPC_RETRY_AFTER_TOO_LONG");
   await sleep(Math.max(1000,delay));continue;
  }
  if(!response.ok)throw Error("RPC_HTTP_"+response.status);
  const payload=await response.json();
  if(payload.error)throw Error("RPC_METHOD_"+method+"_ERROR");
  return payload.result;
 }
 throw Error("RPC_RATE_LIMIT_EXHAUSTED");
}
const report={mint,status:"UNRESOLVED",writeAttempted:false,historyComplete:false};
let progress={};
try{
 // Helius DAS paginated token-account enumeration. A single page does not prove top-30 ranking.
 let page=1,accounts=[],totalKnown=null,complete=false;
 while(page<=10){
  const result=await rpc("getTokenAccounts",{mint,page,limit:100});
  const rows=result?.token_accounts;
  if(!Array.isArray(rows))throw Error("DAS_UNEXPECTED_RESPONSE");
  if(Number.isInteger(result.total))totalKnown=result.total;
  accounts.push(...rows);
  if(rows.length<100 || (totalKnown!==null&&accounts.length>=totalKnown)){complete=true;break;}
  page++;
 }
 report.enumeratedAccounts=accounts.length;
 report.providerTotal=totalKnown;
 report.rankingComplete=complete && totalKnown!==null && accounts.length>=totalKnown;
 report.rankingEvidence=totalKnown!==null?"provider_total":"page_exhaustion";
 if(!complete){report.status="PARTIAL_ACCOUNT_ENUMERATION";console.log(JSON.stringify(report));process.exit(0);}
 const supply=await rpc("getTokenSupply",[mint,{commitment:"confirmed"}]);
 const total=BigInt(supply?.value?.amount||"0");
 if(total<=0n)throw Error("ZERO_SUPPLY");
 const ranked=accounts.map(a=>({tokenAccount:a.address,ownerWallet:a.owner,amount:BigInt(a.amount||"0")}))
  .filter(a=>a.tokenAccount&&a.ownerWallet).sort((a,b)=>a.amount>b.amount?-1:a.amount<b.amount?1:0).slice(0,30);
 const holders=ranked.map(a=>({...a,sharePct:Number(a.amount*1000000n/total)/10000}));
 report.topAccounts=holders.length;
 report.uniqueOwners=new Set(holders.map(x=>x.ownerWallet)).size;
 report.top30SharePct=Number(ranked.reduce((s,x)=>s+x.amount,0n)*1000000n/total)/10000;
 report.concentrationValidation="UNVERIFIED_AMOUNT_UNITS_AND_SUPPLY";
 // Cross-check indexed account amounts against standard Solana RPC raw amounts.
 // This can validate unit interpretation for overlapping accounts, but not
 // whether the provider returned the true global top 30.
 try{
  const largest=await rpc("getTokenLargestAccounts",[mint,{commitment:"confirmed"}]);
  const dasByAccount=new Map(accounts.map(a=>[a.address,String(a.amount)]));
  const comparisons=(largest?.value||[]).map(a=>({
   account:a.address,match:dasByAccount.has(a.address.toString())&&dasByAccount.get(a.address.toString())===String(a.amount)
  }));
  report.rawAmountCrosscheck={rpcAccounts:comparisons.length,matching:comparisons.filter(x=>x.match).length,
   missingOrMismatched:comparisons.filter(x=>!x.match).length};
  if(comparisons.length>0&&comparisons.every(x=>x.match))
   report.concentrationValidation="RAW_AMOUNTS_MATCH_RPC_SAMPLE_GLOBAL_RANKING_UNVERIFIED";
  else report.concentrationValidation="RAW_AMOUNT_OR_ACCOUNT_MISMATCH";
 }catch(e){report.rawAmountCrosscheck={status:"UNAVAILABLE",reason:String(e.message||"RPC_ERROR")};}
 report.globalTop30Verified=false;
 report.top30SharePctStatus="PROVISIONAL_GLOBAL_RANKING_UNVERIFIED";
 report.supplyRaw=total.toString();
 report.top30RawAmount=ranked.reduce((s,x)=>s+x.amount,0n).toString();
 const wallets=[...new Set(holders.map(x=>x.ownerWallet))];
 const transfers=[];
 let inspected=0,failures=0,walletsVisited=0;
 progress={holders,transfers,inspected,failures,walletsVisited};
 for(const wallet of wallets){
  let sigs;
  try{sigs=await rpc("getSignaturesForAddress",[wallet,{limit:3,commitment:"confirmed"}]);}
  catch(e){report.reason=String(e.message);break;}
  walletsVisited++;
  for(const entry of sigs||[]){
   if(entry.err||!entry.signature)continue;
   try{
    const tx=await rpc("getTransaction",[entry.signature,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:1}]);
    inspected++;
    transfers.push(...extractDirectHolderTransfers({transaction:tx,signature:entry.signature,holderWallets:wallets,tokenAccounts:holders}));
   }catch{failures++;}
  }
  progress={holders,transfers,inspected,failures,walletsVisited};
 }
 const graph=buildHolderConnectionGraph({holders,transactions:transfers,historyComplete:false});
 Object.assign(report,{status:report.reason?"PARTIAL_HISTORY_INTERRUPTED":"PARTIAL_HISTORY_OBSERVED",walletsVisited,rateLimitRetries,transactionsInspected:inspected,transactionFailures:failures,
  directEdges:graph.edges,connectedGroups:graph.connectedGroups,connectedWalletCount:graph.connectedWalletCount,
  commonOwnershipEstablished:false,historyComplete:false});
}catch(e){report.status="UNRESOLVED";report.reason=String(e.message||"DIAGNOSTIC_FAILED").replace(/https?:\/\/\S+/g,"[redacted]");
 if(progress.holders){const graph=buildHolderConnectionGraph({holders:progress.holders,transactions:progress.transfers,historyComplete:false});Object.assign(report,{status:"PARTIAL_HISTORY_INTERRUPTED",walletsVisited:progress.walletsVisited,transactionsInspected:progress.inspected,transactionFailures:progress.failures,directEdges:graph.edges,connectedGroups:graph.connectedGroups});}}
report.rateLimitRetries=rateLimitRetries;
console.log(JSON.stringify(report));
