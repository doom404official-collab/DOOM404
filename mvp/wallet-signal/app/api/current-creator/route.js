import {verifyBoundedCreatorOrigin} from '../../../lib/boundedCreatorOriginV2.mjs';
import {NextResponse} from 'next/server';
import {PublicKey} from '@solana/web3.js';
import {createReliableConnection} from '../../../lib/reliableConnection.js';
import {createIntelligenceVault} from '../../../lib/intelligenceVault.mjs';
import {resolveCachedCreator} from '../../../lib/resolveCachedCreator.mjs';
import {withProviderUsage} from '../../../lib/providerUsage.mjs';
export const dynamic='force-dynamic';
const cache=new Map(),active=new Map();
async function handle(request){
 const mint=new URL(request.url).searchParams.get('mint')||'';
 try{if(new PublicKey(mint).toBase58()!==mint)throw Error();}catch{return NextResponse.json({mint,error:'INVALID_MINT'},{status:400});}
 if(active.has(mint)){try{return NextResponse.json({...await active.get(mint),sharedRequest:true});}catch{return NextResponse.json({mint,status:'current_wallet_unavailable'},{status:503});}}
 if(active.size>=20)return NextResponse.json({mint,status:'capacity_limited'},{status:429});
 const saved=cache.get(mint);if(saved&&Date.now()-saved.at<60000)return NextResponse.json({...saved.data,cached:true});
 let timer;const controller=new AbortController();
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('DEADLINE'));},9000);});
 try{
  const work=(async()=>{
   const scopedFetch=(url,init)=>fetch(url,{...init,signal:AbortSignal.any([controller.signal,init?.signal].filter(Boolean))});
   const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl:scopedFetch});
   let attribution=await resolveCachedCreator({mint,vault});
   const connection=createReliableConnection({timeoutMs:2500,retries:0,maxResponseBytes:2000000,fetchImpl:scopedFetch});
   if(attribution.status!=='VERIFIED'||attribution.independentlyReviewed!==true){
    // At most one indexed historical transaction. Never paginate or backfill.
    const indexConnection=createReliableConnection({primary:process.env.ALCHEMY_RPC_URL||process.env.HELIUS_RPC_URL||process.env.SOLANA_RPC_URL,timeoutMs:2500,retries:0,maxResponseBytes:2000000,fetchImpl:scopedFetch});
    const indexed=await indexConnection._rpcRequest('getTransactionsForAddress',[mint,{transactionDetails:'full',sortOrder:'asc',limit:1,commitment:'finalized',encoding:'jsonParsed',maxSupportedTransactionVersion:0,filters:{status:'succeeded'}}]);
    if(indexed.error)return {mint,status:'bounded_origin_provider_unavailable'};
    const first=indexed.result?.data?.[0];const proof=verifyBoundedCreatorOrigin(first,mint);
    if(!proof)return {mint,status:'attribution_unavailable'};
    attribution={creator:proof.creator,status:'ONCHAIN_PROTOCOL_CREATOR',proof};
   }
   const rows=await connection.getParsedTokenAccountsByOwner(new PublicKey(attribution.creator),{mint:new PublicKey(mint)},'finalized');
   if(rows.value.length>1000)throw Error('UNBOUNDED_INVENTORY');let amount=0n;
   const seen=new Set();for(const row of rows.value){const a=row.account,info=a.data?.parsed?.info;if(seen.has(row.pubkey.toBase58())||a.executable!==false||!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(a.owner.toBase58())||a.data.parsed.type!=='account'||info.mint!==mint||info.owner!==attribution.creator||!/^(0|[1-9][0-9]*)$/.test(info.tokenAmount?.amount||''))throw Error('INVALID_HOLDINGS');seen.add(row.pubkey.toBase58());amount+=BigInt(info.tokenAmount.amount);}
   if(amount>18446744073709551615n)throw Error('INVALID_SUPPLY');
   return {version:2,mint,creator:attribution.creator,attribution:attribution.proof||{verification:'reviewed_persisted_attribution',verified:true},status:'verified_current_wallet',rawBalance:amount.toString(),accountCount:rows.value.length,slot:rows.context.slot,observedAt:new Date().toISOString(),scope:'verified_creator_wallet_only',linkedWalletsAssessed:false};
  })();
  const pending=Promise.race([work,deadline]);active.set(mint,pending);const data=await pending;cache.set(mint,{at:Date.now(),data});if(cache.size>100)cache.delete(cache.keys().next().value);return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({mint,status:'current_wallet_unavailable'},{status:503});}finally{active.delete(mint);clearTimeout(timer);controller.abort();}
}
export async function GET(request){return withProviderUsage(handle,request);}
