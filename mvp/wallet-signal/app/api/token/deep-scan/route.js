import {NextResponse} from 'next/server';
import {PublicKey} from '@solana/web3.js';
import {verifyScanUser} from '../../../../lib/verifyScanUser.mjs';
import {createDeepScanQuota} from '../../../../lib/deepScanQuota.mjs';
import {createScanStartLock} from '../../../../lib/scanStartLock.mjs';
import {admitCustomerScan} from '../../../../lib/customerScanAdmission.mjs';
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
  // Authenticate before constructing service-role stores, quota or lock adapters.
  // Unauthenticated callers must receive 401 even if scan infrastructure is unavailable.
  const user=await verifyScanUser({authorization:request.headers.get('authorization'),
   url:process.env.SUPABASE_URL,anonKey:process.env.SUPABASE_ANON_KEY});
  if(!user)return json({error:'authentication_required'},401);
  const store=createHolderJobStore();
  const lockManager=createScanStartLock({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const quota=createDeepScanQuota({url:process.env.SUPABASE_URL,
   serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY,pepper:process.env.GLITCH_SCAN_QUOTA_PEPPER});
  const outcome=await admitCustomerScan({
   mint,authorization:request.headers.get('authorization'),enabled:true,
   verifyUser:async()=>user,
   store,lockManager,quota,
   prepareSnapshot:async mint=>{
    const endpoint=process.env.HELIUS_RPC_URL;
    if(!endpoint?.startsWith('https://'))throw Error('RPC_NOT_CONFIGURED');
    return prepareHolderScanSnapshot({mint,connection:createReliableConnection({primary:endpoint})});
   }
  });
  return json(outcome.body,outcome.status);
 }catch{
  return json({error:'scan_temporarily_unavailable'},503);
 }
}
