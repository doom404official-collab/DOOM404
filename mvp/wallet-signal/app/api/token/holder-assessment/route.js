import {NextResponse} from 'next/server';
import {createTop20Vault} from '../../../../lib/top20Vault.mjs';
import {consolidateTop20} from '../../../../lib/consolidateTop20.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export async function GET(request){
 const mint=new URL(request.url).searchParams.get('mint');
 if(!address.test(mint??''))return NextResponse.json({error:'Invalid Solana mint'},{status:400});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({status:'unavailable',reason:'Assessment storage not configured'},{status:503});
 try{
  const vault=createTop20Vault({url,serviceRoleKey:key});
  const {searchParams}=new URL(request.url);
  const id=searchParams.get('snapshotId');
  if(id&&!/^[a-f0-9]{64}$/.test(id))return NextResponse.json({error:'Invalid snapshot ID'},{status:400});
  const snapshot=id?await vault.getFrozen(id):await vault.getLatestFrozenByMint(mint);
  if(!snapshot)return NextResponse.json({status:'not_assessed',reason:'No completed eligible Top-20 investigation for this token'},{status:404});
  if(snapshot.mint!==mint)return NextResponse.json({error:'Snapshot mint mismatch'},{status:400});
  const batches=await vault.getBatches(snapshot.id);
  if(batches.length!==4)return NextResponse.json({mint,status:'investigation_pending',snapshotId:snapshot.id,processedBatches:batches.length,totalBatches:4},{status:202,headers:{'Cache-Control':'no-store'}});
  const result=consolidateTop20({snapshot,batches});
  return NextResponse.json({mint,assessment:result},{headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({status:'unavailable',reason:'Assessment could not be retrieved'},{status:503});
 }
}
