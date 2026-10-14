import { buildHolderConnectionGraph } from "../lib/holderConnectionGraph.mjs";
import { extractDirectHolderTransfers } from "../lib/directHolderTransfers.mjs";

// Bounded read-only investigation; never claims complete chain history.
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const rpcUrl=process.env.HELIUS_RPC_URL;
if(!rpcUrl)throw Error("HELIUS_RPC_URL_NOT_CONFIGURED");
let requests=0;
async function rpc(method,params){
 if(++requests>150)throw Error("REQUEST_BUDGET_EXHAUSTED");
 const response=await fetch(rpcUrl,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:requests,method,params}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error("RPC_HTTP_"+response.status);
 const payload=await response.json();
 if(payload.error)throw Error("RPC_METHOD_"+method+"_ERROR");
 return payload.result;
}
const report={mint,status:"UNRESOLVED",writeAttempted:false,historyComplete:false};
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
 report.rankingComplete=complete;
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
 const wallets=[...new Set(holders.map(x=>x.ownerWallet))];
 const transfers=[];
 let inspected=0,failures=0;
 for(const wallet of wallets){
  const sigs=await rpc("getSignaturesForAddress",[wallet,{limit:3,commitment:"confirmed"}]);
  for(const entry of sigs||[]){
   if(entry.err||!entry.signature)continue;
   try{
    const tx=await rpc("getTransaction",[entry.signature,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:1}]);
    inspected++;
    transfers.push(...extractDirectHolderTransfers({transaction:tx,signature:entry.signature,holderWallets:wallets,tokenAccounts:holders}));
   }catch{failures++;}
  }
 }
 const graph=buildHolderConnectionGraph({holders,transactions:transfers,historyComplete:false});
 Object.assign(report,{status:"PARTIAL_HISTORY_OBSERVED",transactionsInspected:inspected,transactionFailures:failures,
  directEdges:graph.edges,connectedGroups:graph.connectedGroups,connectedWalletCount:graph.connectedWalletCount,
  commonOwnershipEstablished:false,historyComplete:false});
}catch(e){report.status="UNRESOLVED";report.reason=String(e.message||"DIAGNOSTIC_FAILED").replace(/https?:\/\/\S+/g,"[redacted]");}
console.log(JSON.stringify(report));
