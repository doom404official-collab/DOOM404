// Read-only comparison of Helius DAS and standard RPC token account balance semantics.
// No creator verification, transaction scans, secrets or database writes.
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const endpoint=process.env.HELIUS_RPC_URL;
if(!endpoint)throw Error("HELIUS_RPC_URL_NOT_CONFIGURED");
let id=0;
async function rpc(method,params){
 const res=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:++id,method,params}),signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw Error(method+"_HTTP_"+res.status);
 const data=await res.json();
 if(data.error)throw Error(method+"_RPC_ERROR_"+data.error.code);
 return data.result;
}
const report={mint,status:"UNRESOLVED",writeAttempted:false};
try{
 const [das,largest,supply]=await Promise.all([
  rpc("getTokenAccounts",{mint,page:1,limit:100}),
  rpc("getTokenLargestAccounts",[mint,{commitment:"confirmed"}]),
  rpc("getTokenSupply",[mint,{commitment:"confirmed"}])
 ]);
 const rows=das?.token_accounts||[],rpcRows=largest?.value||[];
 // Probe beyond the apparent total=100: it may be a page-size cap, not global supply.
 const pageProbes=[{page:1,count:rows.length,total:das?.total??null}];
 const subsequentRows=[];
 for(let page=2;page<=10;page++){
  try{
   const next=await rpc("getTokenAccounts",{mint,page,limit:100});
   const items=Array.isArray(next?.token_accounts)?next.token_accounts:[];
   pageProbes.push({page,count:items.length,total:next?.total??null,
    overlapsFirstPage:items.filter(a=>rows.some(b=>String(a.address)===String(b.address))).length});
   subsequentRows.push(...items);
   if(items.length<100)break;
  }catch(e){pageProbes.push({page,error:String(e.message||"PROBE_FAILED")});break;}
 }
 const allObserved=[...rows,...subsequentRows];
 const observedAddresses=new Set(allObserved.map(a=>String(a.address)));
 const rpcTop20SeenAcrossPages=rpcRows.slice(0,20).filter(a=>observedAddresses.has(String(a.address))).length;
 const lastPage=pageProbes.at(-1);
 const enumerationExhausted=lastPage?.count===0|| (Number.isInteger(lastPage?.count)&&lastPage.count<100);
 const totalInconsistent=pageProbes.some(p=>p.page>1&&p.count>0&&p.total===100);
 const byAddress=new Map(rows.map(a=>[String(a.address),a]));
 const topRpc=rpcRows.slice(0,20);
 const comparisons=topRpc.map(a=>{
  const indexed=byAddress.get(String(a.address));
  const raw=String(a.amount);
  const dasAmount=indexed?.amount==null?null:String(indexed.amount);
  const same=dasAmount===raw;
  return {tokenAccount:String(a.address),foundInDas:Boolean(indexed),
   rpcRawAmount:raw,dasAmount,exactRawMatch:same,
   dasFields:indexed?Object.keys(indexed).sort():[]};
 });
 const rpcTop20Raw=topRpc.reduce((sum,a)=>sum+BigInt(a.amount),0n);
 const supplyRaw=BigInt(supply?.value?.amount||"0");
 const dasAmounts=rows.map(a=>({address:String(a.address),amount:String(a.amount)}));
 const dasRawSum=dasAmounts.every(a=>/^\d+$/.test(a.amount))?
  dasAmounts.reduce((sum,a)=>sum+BigInt(a.amount),0n):null;
 Object.assign(report,{status:"CROSSCHECK_COMPLETE",dasReturned:rows.length,
  dasTotal:das?.total??null,tokenSupplyRaw:supplyRaw.toString(),
  tokenDecimals:supply?.value?.decimals??null,
  rpcTop20SharePct:supplyRaw>0n?Number(rpcTop20Raw*1000000n/supplyRaw)/10000:null,
  dasFirstPageSharePct:dasRawSum!==null&&supplyRaw>0n?Number(dasRawSum*1000000n/supplyRaw)/10000:null,
  matches:comparisons.filter(a=>a.exactRawMatch).length,
  missing:comparisons.filter(a=>!a.foundInDas).length,
  amountMismatch:comparisons.filter(a=>a.foundInDas&&!a.exactRawMatch).length,
  comparisons:comparisons.slice(0,5),
  dasSampleFields:rows[0]?Object.keys(rows[0]).sort():[],
  globalRankingVerified:false,
  paginationProbe:{pages:pageProbes,uniqueAccountsAcrossPages:observedAddresses.size,rpcTop20SeenAcrossPages,enumerationExhausted,totalInconsistent,globalEnumerationEstablished:enumerationExhausted && !pageProbes.some(p=>p.error)},
  investigation:{
   dasReturnedMintMatches:rows.filter(a=>String(a.mint)===mint).length,
   dasUniqueTokenAccounts:new Set(rows.map(a=>String(a.address))).size,
   dasUniqueOwnerWallets:new Set(rows.map(a=>String(a.owner))).size,
   dasFirstAccountIsRpcTop20:topRpc.some(a=>String(a.address)===String(rows[0]?.address)),
   providerTotalIsVerifiedGlobalCount:false,
   rpcTop20MissingFromDas:comparisons.filter(a=>!a.foundInDas).length,
   nextAction:"Check DAS pagination semantics, endpoint completeness and mint filtering before selecting ranked holders"
  },
  note:"A DAS total/page count is not proof of global top-holder ranking. Investigate amount units and inclusion of RPC top accounts."});
}catch(e){report.reason=String(e.message||"UNKNOWN_ERROR").replace(/https?:\/\/\S+/g,"[redacted]");}
console.log(JSON.stringify(report));
if(report.status!=="CROSSCHECK_COMPLETE")process.exitCode=2;
