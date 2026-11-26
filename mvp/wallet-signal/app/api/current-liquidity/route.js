import {collectAlchemyQuotesV2} from '../../../lib/alchemyExecutableQuotesV2.mjs';
import {RAYDIUM_CPMM_PROGRAM,decodeCpmmPool,projectRaydiumCpmmV2} from '../../../lib/raydiumCpmmAssessmentV2.mjs';
import {NextResponse} from 'next/server';
import {PublicKey} from '@solana/web3.js';
import {PUMP_AMM_SDK,PUMP_AMM_PROGRAM_ID,GLOBAL_CONFIG_PDA,PUMP_AMM_FEE_CONFIG_PDA} from '@pump-fun/pump-swap-sdk';
import {createReliableConnection} from '../../../lib/reliableConnection.js';
import {projectPumpLiquidityV2} from '../../../lib/pumpLiquidityAssessmentV2.mjs';
import {withProviderUsage} from '../../../lib/providerUsage.mjs';
export const dynamic='force-dynamic';
const cache=new Map(),active=new Map();
async function handle(request){
 const u=new URL(request.url),mint=u.searchParams.get('mint'),poolAddress=u.searchParams.get('pool');
 try{if(new PublicKey(mint).toBase58()!==mint||new PublicKey(poolAddress).toBase58()!==poolAddress)throw Error();}catch{return NextResponse.json({error:'INVALID_MINT_OR_POOL'},{status:400});}
 const id=mint+':'+poolAddress,saved=cache.get(id);
 if(active.size>=20&&!active.has(id))return NextResponse.json({mint,status:'capacity_limited'},{status:429});
 if(saved&&Date.now()-saved.at<60000)return NextResponse.json({...saved.data,cached:true},{headers:{'Cache-Control':'no-store'}});
 const collect=async()=>{
  const controller=new AbortController();let timer;let batchProvider="configured_rpc";const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('DEADLINE'));},9000);});
  try{
   const connection=createReliableConnection({timeoutMs:2500,retries:0,maxResponseBytes:2000000,fetchImpl:(url,init)=>{if(controller.signal.aborted)throw Error('DEADLINE');const host=new URL(url).hostname;batchProvider=host.includes('alchemy')?'alchemy':host.includes('helius')?'helius':'configured_rpc';return fetch(url,{...init,signal:AbortSignal.any([init.signal,controller.signal].filter(Boolean))});}});
   const work=(async()=>{
    const first=await connection.getAccountInfo(new PublicKey(poolAddress),'finalized');
    if(first?.owner.toBase58()===RAYDIUM_CPMM_PROGRAM){
     const cp=decodeCpmmPool(first);if(!cp)return {mint,status:'unsupported_or_incompatible_configuration'};
     const addresses=[poolAddress,cp.vaultA.toBase58(),cp.vaultB.toBase58(),cp.mintA.toBase58(),cp.mintB.toBase58(),cp.mintLp.toBase58(),cp.configId.toBase58()];
     const batch=await connection.getMultipleAccountsInfoAndContext(addresses.map(x=>new PublicKey(x)),{commitment:'finalized'});
     const raw={schemaVersion:1,provider:batchProvider,commitment:'finalized',observedAt:new Date().toISOString(),addresses,response:{context:batch.context,value:batch.value.map(a=>a?{owner:a.owner.toBase58(),executable:a.executable,space:a.data.length,data:[a.data.toString('base64'),'base64']}:null)}};
     const observation=projectRaydiumCpmmV2(raw,mint);return observation?{mint,status:'verified_protocol_calculation',observation}:{mint,status:'unsupported_or_incompatible_configuration'};
    }
    if(!first||first.owner.toBase58()!==PUMP_AMM_PROGRAM_ID.toBase58()||first.executable!==false){
     const observation=await collectAlchemyQuotesV2({mint,rpcUrl:process.env.ALCHEMY_RPC_URL,signal:controller.signal});
     return observation?{mint,status:'verified_executable_routes',observation}:{mint,status:'unsupported_pool_architecture',missing:['Pool-specific controls and executable quote evidence unavailable; no constant-product assumptions applied.']};
    }
    const p=PUMP_AMM_SDK.decodePool(first);
    if(p.baseMint.toBase58()!==mint)return {mint,status:'pool_mint_mismatch'};
    const lp=await connection.getTokenLargestAccounts(p.lpMint,'finalized');
    const lpKeys=lp.value.slice(0,20).map(x=>x.address.toBase58());
    const addresses=[poolAddress,p.poolBaseTokenAccount.toBase58(),p.poolQuoteTokenAccount.toBase58(),mint,p.lpMint.toBase58(),p.quoteMint.toBase58(),GLOBAL_CONFIG_PDA.toBase58(),PUMP_AMM_FEE_CONFIG_PDA.toBase58(),...lpKeys];
    const batch=await connection.getMultipleAccountsInfoAndContext(addresses.map(x=>new PublicKey(x)),{commitment:'finalized'});
    const raw={schemaVersion:1,provider:batchProvider,network:'solana-mainnet',commitment:'finalized',observedAt:new Date().toISOString(),addresses,lpTokenAccounts:lpKeys,response:{context:batch.context,value:batch.value.map(a=>a?{owner:a.owner.toBase58(),executable:a.executable,space:a.data.length,data:[a.data.toString('base64'),'base64']}:null)}};
    // Provider label identifies the existing RPC evidence pipeline, not a guarantee
    // that the configured fallback endpoint was Alchemy; no provider URL is public.
    const observation=projectPumpLiquidityV2(raw,mint);
    return observation?{mint,status:'verified_protocol_calculation',observation}:{mint,status:'unsupported_or_incompatible_configuration'};
   })();
   const data=await Promise.race([work,deadline]);cache.set(id,{at:Date.now(),data});if(cache.size>100)cache.delete(cache.keys().next().value);return data;
  }finally{clearTimeout(timer);controller.abort();}
 };
 try{
  let work=active.get(id);const shared=!!work;if(!work){work=collect();active.set(id,work);work.finally(()=>active.delete(id)).catch(()=>{});}
  const data=await work;return NextResponse.json({...data,sharedRequest:shared},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({mint,status:'unavailable',missing:['Current liquidity read failed or exceeded nine seconds.']},{status:503});}
}
export async function GET(request){return withProviderUsage(handle,request);}
