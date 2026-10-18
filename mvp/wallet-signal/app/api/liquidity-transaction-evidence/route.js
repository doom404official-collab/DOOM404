import {NextResponse} from "next/server";
import {PublicKey} from "@solana/web3.js";
import {createReliableConnection} from "../../../lib/reliableConnection.js";
import {summarizePoolSignatures} from "../../../lib/liquidityTransactionEvidence.mjs";
export const dynamic="force-dynamic";
export async function POST(request){
 let payload;
 try{payload=await request.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 let pool;
 try{pool=new PublicKey(payload?.poolAddress);if(pool.toBase58()!==payload.poolAddress)throw Error();}catch{return NextResponse.json({error:"Invalid pool address"},{status:400});}
 try{
  const connection=createReliableConnection({timeoutMs:8000,retries:1});
  const signatures=await connection.getSignaturesForAddress(pool,{limit:50},"confirmed");
  return NextResponse.json({poolAddress:pool.toBase58(),observedAt:new Date().toISOString(),source:"Solana RPC getSignaturesForAddress",...summarizePoolSignatures(signatures)},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"unavailable",reason:"Transaction signature evidence unavailable"},{status:503});}
}
