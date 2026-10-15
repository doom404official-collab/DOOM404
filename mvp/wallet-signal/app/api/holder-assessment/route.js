import {NextResponse} from "next/server";
import {PublicKey} from "@solana/web3.js";
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
import {createHolderEvidenceStore} from "../../../lib/holderEvidenceStore.mjs";
import {assessVerifiedHolderConcentration} from "../../../lib/verifiedHolderConcentrationAssessment.mjs";
export const dynamic="force-dynamic";
export async function GET(request){
 let mint;
 try{mint=new PublicKey(new URL(request.url).searchParams.get("mint")||"").toBase58();}
 catch{return NextResponse.json({error:"Invalid token mint"},{status:400});}
 try{
  const job=await createHolderJobStore().getLatest(mint);
  if(!job?.checkpoint)return NextResponse.json({mint,status:"not_started"},{headers:{"Cache-Control":"no-store"}});
  const evidenceRows=await createHolderEvidenceStore().listForJob(job.id);
  const assessment=assessVerifiedHolderConcentration({checkpoint:job.checkpoint,evidenceRows});
  return NextResponse.json({mint,scanStatus:job.status,updatedAt:job.updated_at,assessment},
   {headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Holder assessment unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
