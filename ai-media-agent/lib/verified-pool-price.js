"use strict";
const {encode,classifyPool,POOLS}=require('./holder-classification');
const {QUOTE_MINTS}=require('./market-selection');
const {marketFallback}=require('./market-fallback');
function reserveRatio(inputRaw,quoteRaw,inputDecimals,quoteDecimals){
 if(!/^\d+$/.test(inputRaw)||!/^\d+$/.test(quoteRaw)||BigInt(inputRaw)<=0n||BigInt(quoteRaw)<=0n||![inputDecimals,quoteDecimals].every(d=>Number.isInteger(d)&&d>=0&&d<=18))throw Error('INVALID_RESERVES');
 const numerator=BigInt(quoteRaw)*10n**BigInt(inputDecimals),denominator=BigInt(inputRaw)*10n**BigInt(quoteDecimals),ratio=Number(numerator)/Number(denominator);if(!Number.isFinite(ratio)||ratio<=0)throw Error('INVALID_RATIO');return ratio;
}
async function verifiedPoolPrice({mint,holders,fetchImpl=fetch,rpcUrl=process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com'}){
 const candidate=(holders?.accounts||[]).find(a=>a.classification==='VERIFIED_PUMPSWAP_POOL_VAULT'&&a.classificationEvidence?.pool);
 if(!candidate)return {status:'NO_VERIFIED_SUPPORTED_POOL'};
 let requests=0;const rpc=async(method,params)=>{requests++;const r=await fetchImpl(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('RPC_UNAVAILABLE');const j=await r.json();if(j.error||!j.result)throw Error('RPC_UNAVAILABLE');return j.result};
 try{
 const poolAddress=candidate.classificationEvidence.pool,account=(await rpc('getAccountInfo',[poolAddress,{encoding:'base64',commitment:'confirmed'}])).value;
 const layout=POOLS.find(p=>p.protocol==='PumpSwap');if(account?.owner!==layout.program||account.executable!==false||account.data?.[1]!=='base64')throw Error('POOL_IDENTITY_FAILED');
 const raw=Buffer.from(account.data[0],'base64');if(raw.length<layout.minimum)throw Error('POOL_LAYOUT_FAILED');
 const mints=layout.mints.map(o=>encode(raw.subarray(o,o+32))),vaults=layout.vaults.map(o=>encode(raw.subarray(o,o+32))),index=mints.indexOf(mint),other=1-index;
 if(index<0||mints[0]===mints[1]||!QUOTE_MINTS.has(mints[other]))throw Error('UNSUPPORTED_QUOTE');
 const reads=await rpc('getMultipleAccounts',[[...mints,...vaults],{encoding:'jsonParsed',commitment:'confirmed'}]);
 const [ma,mb,va,vb]=reads.value,parsedMints=[ma,mb],parsedVaults=[va,vb];
 for(let i=0;i<2;i++){
  if(parsedMints[i]?.data?.parsed?.type!=='mint'||parsedMints[i].owner!==parsedVaults[i]?.owner)throw Error('MINT_UNITS_FAILED');
  const check=classifyPool({mint:mints[i],tokenAccount:vaults[i],parsed:parsedVaults[i],pool:{address:poolAddress,account},slot:reads.context.slot});if(check?.classification!=='VERIFIED_PUMPSWAP_POOL_VAULT')throw Error('VAULT_IDENTITY_FAILED');
 }
 const decimals=parsedMints.map(x=>x.data.parsed.info.decimals),balances=parsedVaults.map(x=>x.data.parsed.info.tokenAmount);
 if(balances.some((x,i)=>x.decimals!==decimals[i]))throw Error('RESERVE_DECIMALS_FAILED');
 const quote=await marketFallback({mint:mints[other],decimals:decimals[other],primary:null,fetchImpl,rpcUrl});
 if(!quote.market)throw Error('QUOTE_PRICE_UNAVAILABLE');
 const ratio=reserveRatio(balances[index].amount,balances[other].amount,decimals[index],decimals[other]),observedAt=new Date().toISOString();
 return {status:'VERIFIED_PUMPSWAP_RESERVE_REFERENCE',rpcRequests:requests,market:{priceUsd:ratio*quote.market.priceUsd,source:'Verified PumpSwap constant-product reserve reference',pairAddress:poolAddress,observedAt,priceObservedAt:observedAt,confidence:'VERIFIED_RESERVES_WITH_PROVIDER_QUOTE_PRICE',scope:'Reserve ratio before fees; not an executable sell price. Pool and vaults are separate observed reads.',quoteMint:mints[other],quotePrice:quote.market,reserveEvidence:{pool:poolAddress,vaults,mints,decimals,inputIndex:index,rawBalances:balances.map(x=>x.amount),slot:reads.context.slot,quotePerToken:ratio,layoutSource:candidate.classificationEvidence.layoutSource}}};
 }catch(e){return {status:/^[A-Z_]+$/.test(e.message)?e.message:'POOL_PRICE_UNAVAILABLE',rpcRequests:requests}}
}
module.exports={verifiedPoolPrice,reserveRatio};
