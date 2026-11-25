"use strict";
const {classify,POOLS,pda,encode}=require('../lib/holder-classification');
const {accountHolders}=require('../lib/holder-accounting');
const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const providers=[...(process.env.SOLANA_RPC_URL?[{name:'configured',url:process.env.SOLANA_RPC_URL}]:[]),{name:'solana-public',url:'https://api.mainnet-beta.solana.com'}];
async function rpc(provider,method,params){const r=await fetch(provider.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(8500)});if(!r.ok)throw Object.assign(Error('RPC HTTP '+r.status),{safeCode:'RPC_'+method+'_HTTP_'+r.status});const j=await r.json();if(j.error?.code===-32016&&method==='getMultipleAccounts'&&params[1]?.minContextSlot){const relaxed=[params[0],{...params[1]}];delete relaxed[1].minContextSlot;const retry=await rpc(provider,method,relaxed);retry.context={...retry.context,minContextFallback:true,requestedMinContextSlot:params[1].minContextSlot};return retry;}if(j.error||!j.result)throw Object.assign(Error('RPC response error'),{safeCode:'RPC_'+method+'_ERROR_'+(Number.isInteger(j.error?.code)?j.error.code:'EMPTY')});return j.result}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 const mint=req.query.mint;if(typeof mint!=='string'||!BASE58.test(mint))return res.status(400).json({error:'Invalid mint'});
 const diagnostics=[];
 for(const provider of providers){let phase="rank-and-supply";try{
 const [largest,supply]=await Promise.all([rpc(provider,'getTokenLargestAccounts',[mint,{commitment:'confirmed'}]),rpc(provider,'getTokenSupply',[mint,{commitment:'confirmed'}])]);
 phase="parse-accounts";const rows=largest.value.slice(0,20),addresses=rows.map(x=>x.address);
 const parsed=addresses.length?await rpc(provider,'getMultipleAccounts',[addresses,{encoding:'jsonParsed',commitment:'confirmed',minContextSlot:largest.context.slot}]):{value:[],context:largest.context};
 phase="resolve-owners";const owners=[...new Set(parsed.value.map(x=>x?.data?.parsed?.info?.owner).filter(Boolean))];
 let inspected={value:[],context:{slot:null}},controlInspection='UNAVAILABLE';
 if(owners.length)try{inspected=await rpc(provider,'getMultipleAccounts',[owners,{encoding:'base64',commitment:'confirmed',minContextSlot:parsed.context.slot}]);controlInspection='COMPLETE'}catch{}
 const controls=new Map(owners.map((owner,i)=>[owner,inspected.value[i]||null]));
 const pools=owners.filter(owner=>controls.get(owner)).map(address=>({address,account:controls.get(address),slot:inspected.context.slot}));
 // Global-authority protocols do not store pool state at the token owner address.
 // Look up the exact sampled vault, capped at eight filtered queries per request.
 const discovery=[],jobs=[];let queries=0;
 for(const row of rows){const i=addresses.indexOf(row.address),owner=parsed.value[i]?.data?.parsed?.info?.owner;
 for(const protocol of POOLS.filter(p=>p.authority!=='pool')){
 const seed=protocol.authority==='cpmm'?'vault_and_lp_mint_auth_seed':'amm authority';
 const authority=encode(pda([Buffer.from(seed)],protocol.program));if(owner!==authority)continue;
 for(const offset of protocol.vaults){if(queries>=8){discovery.push({vault:row.address,status:'QUERY_BUDGET_REACHED'});break}queries++;
 jobs.push((async()=>{try{const result=await rpc(provider,'getProgramAccounts',[protocol.program,{encoding:'base64',commitment:'confirmed',withContext:true,minContextSlot:parsed.context.slot,filters:[{dataSize:protocol.minimum},{memcmp:{offset,bytes:row.address}}]}]);for(const item of result.value||[])pools.push({address:item.pubkey,account:item.account,slot:result.context.slot});discovery.push({vault:row.address,protocol:protocol.protocol,slot:result.context.slot,status:'EXECUTED',matches:result.value?.length||0})}catch{discovery.push({vault:row.address,protocol:protocol.protocol,status:'UNAVAILABLE'})}})());
 }
 }
 }
 await Promise.allSettled(jobs);
 phase="classify-accounts";const accounts=rows.map((row,i)=>{
 const info=parsed.value[i]?.data?.parsed?.info,owner=info?.owner||null,control=controls.get(owner);
 let result=classify({mint,tokenAccount:row.address,parsed:parsed.value[i],control,slot:inspected.context.slot});
 for(const pool of pools){const check=classify({mint,tokenAccount:row.address,parsed:parsed.value[i],control:null,pools:[pool],slot:pool.slot});if(check.classification!=='UNCLASSIFIED'){result=check;break}}
 return {tokenAccount:row.address,tokenOwner:result.ownerVerified?owner:null,rawAmount:row.amount,sharePercent:Number(BigInt(row.amount)*100000000n/BigInt(supply.value.amount))/1000000,...result,ownerAccountProgram:control?.owner||null,ownerAccountExecutable:control?.executable??null,ownerControlType:control?(control.owner==='11111111111111111111111111111111'?'SYSTEM_OWNED_ADDRESS':'PROGRAM_OWNED_ADDRESS'):'UNRESOLVED',balanceChangedSinceRanking:info?.tokenAmount?.amount!==row.amount,explorer:'https://solscan.io/account/'+row.address};
 });
 phase="reconcile-supply";const accounting=accountHolders(accounts,supply.value.amount);
 const response={mint,supply:{raw:supply.value.amount,decimals:supply.value.decimals,slot:supply.context.slot},...accounting,accounts:accounts.map(a=>({...a,sameOwnerTokenAccounts:accounting.ownerGroups.find(g=>g.owner===a.tokenOwner)?.count??null})),targetedOwners:accounts.filter(a=>a.ownerControlType!=='SYSTEM_OWNED_ADDRESS'),provider:provider.name,observedAt:new Date().toISOString(),largestAccountsSlot:largest.context.slot,ownerResolutionSlot:parsed.context.slot,ownerReadContext:{minContextFallback:parsed.context.minContextFallback===true,rankingSlot:largest.context.slot,observationSlot:parsed.context.slot,rankingLagSlots:Math.max(0,largest.context.slot-parsed.context.slot),scope:"Independent RPC observations; account owners and balances are observed at the explicit resolution slot, not a synchronized ranking snapshot."},controlInspectionSlot:inspected.context.slot,controlInspection,infrastructureCheck:accounting.classifiedInfrastructureCount?'VERIFIED':'NOT_ESTABLISHED',infrastructureSlot:inspected.context.slot,knownCurveState:'NOT_SEPARATELY_QUERIED',knownCurveBalanceRaw:null,knownCurveSlot:null,poolDiscovery:{queryLimit:8,queries,results:discovery},observedWalletRelationships:{status:'NOT_QUERIED_HERE',source:'Reuse bounded relationships pipeline'},classificationPolicy:'Only exact protocol pool/curve mint, vault and authority checks exclude infrastructure. All unresolved accounts remain included. Separate RPC reads are not a synchronized snapshot.',unresolved:['Custody identity','Beneficial ownership','Holder independence','Historical funding','Trade coordination','Infrastructure outside bounded discovery may remain included']};
 return res.status(200).json(response);
 }catch(e){diagnostics.push(provider.name+':'+phase+':'+(/^[A-Za-z0-9_-]{1,80}$/.test(e.safeCode||'')?e.safeCode:e.name==='TimeoutError'?'TIMEOUT':/^(INVALID_SUPPLY|DUPLICATE_TOKEN_ACCOUNT|INVALID_BALANCE|SAMPLE_EXCEEDS_SUPPLY)$/.test(e.message)?e.message:'RPC_OR_ACCOUNTING_FAILED'))}}
 return res.status(503).json({error:'Owner resolution unavailable',code:'OWNER_RPC_UNAVAILABLE',diagnostics});
};
