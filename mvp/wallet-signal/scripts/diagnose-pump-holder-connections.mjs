import {normalizeTopHolderAccounts} from "../lib/topHolderAccounts.mjs";
import {buildHolderConnectionGraph} from "../lib/holderConnectionGraph.mjs";
import {extractDirectHolderTransfers} from "../lib/directHolderTransfers.mjs";

// Read-only bounded holder investigation. Never treats missing history as no links.
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const endpoint=process.env.HELIUS_RPC_URL;
if(!endpoint||!/^https:\/\//.test(endpoint))throw Error("HELIUS_RPC_URL_REQUIRED");
let calls=0;
async function rpc(method,params){
 if(++calls>160)throw Error("REQUEST_BUDGET_EXHAUSTED");
 const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:calls,method,params}),signal:AbortSignal.timeout(15000),cache:"no-store"});
 if(!response.ok)throw Error("RPC_HTTP_"+response.status);
 const json=await response.json();
 if(json.error)throw Error("RPC_METHOD_ERROR_"+json.error.code);
 return json.result;
}
const report={mint,status:"UNRESOLVED",writeAttempted:false,historyComplete:false};
try{
 const supply=await rpc("getTokenSupply",[mint,{commitment:"confirmed"}]);
 const rawSupply=supply?.value?.amount;
 let all=[],page=1,complete=false;
 for(;page<=5;page++){
  const data=await rpc("getTokenAccounts",{mint,limit:1000,page,options:{showZeroBalance:false}});
  const rows=data?.token_accounts;
  if(!Array.isArray(rows))throw Error("DAS_RESPONSE_INVALID");
  all.push(...rows);
  if(rows.length<1000){complete=true;break;}
 }
 report.pagesFetched=page;
 report.accountsFetched=all.length;
 report.holderListComplete=complete;
 if(!complete)throw Error("HOLDER_PAGINATION_INCOMPLETE");
 const normalized=normalizeTopHolderAccounts({mint,supplyRaw:rawSupply,source:"helius_das_getTokenAccounts",
  rows:all.map(x=>({tokenAccount:x.address,ownerWallet:x.owner,amount:String(x.amount)}))
    .filter(x=>x.tokenAccount&&x.ownerWallet&&/^\d+$/.test(x.amount))
    .sort((a,b)=>{const A=BigInt(a.amount),B=BigInt(b.amount);return A>B?-1:A<B?1:0;})});
 report.holderStatus=normalized.status;
 if(normalized.status!=="TOP_30_ACCOUNTS_OBSERVED")throw Error(normalized.status);
 const accounts=normalized.accounts;
 const wallets=[...new Set(accounts.map(x=>x.ownerWallet))];
 report.top30AccountSharePct=normalized.top30AccountSharePct;
 report.ownerWalletCount=wallets.length;
 // Scan both wallet and sampled token-account addresses: token transfers often
 // reference token accounts rather than their controlling wallets.
 const targets=[...new Set([...wallets,...accounts.map(x=>x.tokenAccount)])];
 const sigMap=new Map();
 let historyRequests=0;
 for(const address of targets){
  const entries=await rpc("getSignaturesForAddress",[address,{limit:30,commitment:"confirmed"}]);
  historyRequests++;
  for(const row of entries||[]){
   if(row?.err||!row?.signature)continue;
   const item=sigMap.get(row.signature)||new Set();
   item.add(address);sigMap.set(row.signature,item);
  }
 }
 report.historyAddressesChecked=historyRequests;
 report.uniqueSignaturesObserved=sigMap.size;
 // Prioritize signatures seen against multiple sampled addresses; fetch at most
 // 75 transactions. Other transfers may remain undiscovered.
 const candidates=[...sigMap].filter(([,addresses])=>addresses.size>1).slice(0,75);
 const transfers=[];
 for(const [signature] of candidates){
  const tx=await rpc("getTransaction",[signature,{encoding:"jsonParsed",commitment:"confirmed",maxSupportedTransactionVersion:1}]);
  transfers.push(...extractDirectHolderTransfers({transaction:tx,signature,holderWallets:wallets,tokenAccounts:accounts}));
 }
 const graph=buildHolderConnectionGraph({holders:accounts,transactions:transfers,historyComplete:false});
 report.status="PARTIAL_HOLDER_CONNECTIONS_OBSERVED";
 report.transactionsDecoded=candidates.length;
 report.directEdges=graph.edges;
 report.connectedGroups=graph.connectedGroups;
 report.connectedWalletCount=graph.connectedWalletCount;
 report.warning="Only 30 recent signatures per sampled address and at most 75 intersecting transactions were examined. No link observed does not mean no link exists. A connection is not common ownership.";
}catch(error){
 report.status="UNRESOLVED";
 report.reason=String(error.message||"INVESTIGATION_FAILED").replace(/https?:\/\/\S+/g,"[redacted]").slice(0,90);
}
console.log(JSON.stringify(report));
process.exitCode=report.status==="PARTIAL_HOLDER_CONNECTIONS_OBSERVED"?0:2;
