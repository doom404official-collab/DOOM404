import {NextResponse} from "next/server";
import {PublicKey} from "@solana/web3.js";
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
export const dynamic="force-dynamic";
export async function GET(request){
 let mint;
 try{mint=new PublicKey(new URL(request.url).searchParams.get("mint")||"").toBase58();}
 catch{return NextResponse.json({error:"Invalid token mint"},{status:400});}
 try{
  const store=createHolderJobStore();
  const row=await store.getLatest(mint);
  if(!row)return NextResponse.json({mint,status:"not_started"},{headers:{"Cache-Control":"no-store"}});
  const view=store.publicView(row);
  return NextResponse.json({mint,status:row.status,scan:view},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Holder scan status unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
