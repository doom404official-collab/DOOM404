import {withScannerAdmission} from '../../../lib/scannerAdmission.mjs';
import {createTokenInvestigationStore,publicInvestigation,publicTokenObservation} from '../../../lib/tokenInvestigationStore.mjs';
import {investigateToken} from '../../../lib/boundedTokenInvestigation.mjs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request){
 return withScannerAdmission(request,async (request)=>{
  const u=new URL(request.url),mint=u.searchParams.get('mint');
  const store=createTokenInvestigationStore();
  if(u.searchParams.get('run')!=='1')return Response.json({mint,...publicInvestigation(await store.read(mint))});
  const previous=await store.read(mint);
  await store.expirePriorRevision(mint,previous);
  const claim=await store.claim(mint);
  if(claim.status==='cached')return Response.json({...publicTokenObservation(claim.observation),cached:true});
  if(claim.status!=='claimed')return Response.json({mint,status:claim.status},{status:202});
  const endpoint=process.env.ALCHEMY_RPC_URL||process.env.ALCHEMY_SOLANA_ARCHIVE_RPC_URL||process.env.SOLANA_RPC_URL||process.env.HELIUS_RPC_URL;
  const secondary=process.env.HELIUS_RPC_URL&&process.env.HELIUS_RPC_URL!==endpoint?process.env.HELIUS_RPC_URL:null;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),34000);let requests=0;
  try{
   const observation=await investigateToken({mint,previousObservation:previous?.observation,providerName:new URL(endpoint).hostname.includes('alchemy')?'alchemy':new URL(endpoint).hostname.includes('helius')?'helius':'configured_rpc',alternateProviderName:secondary?'helius':null,rpc:async(method,params,{provider}={})=>{
    controller.signal.throwIfAborted();
    // The durable guard reserves every logical request across all instances
    // and waits only for an actual aggregate burst. No unconditional delay.
    if(++requests>18)throw Error('BOUNDED_REQUEST_LIMIT');
    const r=await fetch(provider==='secondary'&&secondary?secondary:endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:requests,method,params}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(3500)])});
    if(!r.ok)throw Error('PROVIDER_TEMPORARILY_UNAVAILABLE');const reader=r.body.getReader(),chunks=[];let size=0;try{while(true){const x=await reader.read();if(x.done)break;size+=x.value.byteLength;if(size>2000000){await reader.cancel();throw Error('BOUNDED_RESPONSE_LIMIT');}chunks.push(x.value);}}finally{reader.releaseLock();}const payload=JSON.parse(Buffer.concat(chunks).toString());if(payload.error){const e=Error('RPC_METHOD_ERROR');e.code=payload.error.code;throw e;}return payload.result;
   }});
   await store.finish(mint,claim.owner,observation);
   return Response.json(publicTokenObservation(observation),{headers:{'Cache-Control':'no-store'}});
  }finally{clearTimeout(timer);controller.abort();}
 },'token-investigation');
}
