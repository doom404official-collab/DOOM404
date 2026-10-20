import {NextResponse} from 'next/server';
import {readDashboardEvidence} from '../../../lib/dashboardEvidenceBridge.mjs';
export const dynamic='force-dynamic';
export async function GET(request){
 const mint=new URL(request.url).searchParams.get('mint')||'';
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint))return NextResponse.json({error:'INVALID_MINT'},{status:400});
 try{
  const evidence=await readDashboardEvidence({mint,url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY});
  return NextResponse.json(evidence,{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({mint,status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
