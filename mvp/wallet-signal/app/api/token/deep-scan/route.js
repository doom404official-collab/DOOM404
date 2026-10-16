import {NextResponse} from 'next/server';
import {PublicKey} from '@solana/web3.js';
import {verifyScanUser} from '../../../../lib/verifyScanUser.mjs';
import {createDeepScanQuota} from '../../../../lib/deepScanQuota.mjs';
import {createScanStartLock} from '../../../../lib/scanStartLock.mjs';
import {createHolderJobStore} from '../../../../lib/holderJobStore.mjs';
import {createReliableConnection} from '../../../../lib/reliableConnection.js';
import {prepareHolderScanSnapshot} from '../../../../lib/prepareHolderScanSnapshot.mjs';
export const dynamic='force-dynamic';
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request){
 if(process.env.GLITCH_PUBLIC_DEEP_SCAN_ENABLED!=='true')return json({status:'disabled'},503);
 let mint;
 try{mint=new PublicKey((await request.json())?.mint??'').toBase58();}
 catch{return json({error:'invalid_mint'},400);}
 try{
  const user=await verifyScanUser({authorization:request.headers.get('authorization'),
   url:process.env.SUPABASE_URL,anonKey:process.env.SUPABASE_ANON_KEY});
  if(!user)return json({error:'authentication_required'},401);
  const store=createHolderJobStore();
  const existing=await store.getLatest(mint);
  if(existing&&['queued','running','partial'].includes(existing.status))
   return json({mint,status:existing.status,jobId:existing.id,reused:true},202);
  const lockManager=createScanStartLock({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const lock=await lockManager.acquire(mint);
  if(!lock)return json({mint,status:'preparing',reused:true},202);
  try{
   // Recheck under the distributed lock: another requester may have queued the job.
   const current=await store.getLatest(mint);
   if(current&&['queued','running','partial'].includes(current.status))
    return json({mint,status:current.status,jobId:current.id,reused:true},202);
   const quota=createDeepScanQuota({url:process.env.SUPABASE_URL,
    serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY,pepper:process.env.GLITCH_SCAN_QUOTA_PEPPER});
   if(!await quota.admit({requesterId:user.id,mint}))return json({error:'scan_quota_exceeded'},429);
   const endpoint=process.env.HELIUS_RPC_URL;
   if(!endpoint?.startsWith('https://'))throw Error('RPC_NOT_CONFIGURED');
   const connection=createReliableConnection({primary:endpoint});
   const snapshot=await prepareHolderScanSnapshot({mint,connection});
   const job=await store.createOrReuse(snapshot);
   return json({mint,status:job.status,jobId:job.id,reused:false},202);
  }finally{await lockManager.release(lock);}
 }catch(error){
  console.error('PUBLIC_DEEP_SCAN_START_FAILED',{code:String(error?.message||'UNAVAILABLE').replace(/[^A-Z0-9_]/g,'').slice(0,64)});
  return json({error:'scan_temporarily_unavailable'},503);
 }
}
