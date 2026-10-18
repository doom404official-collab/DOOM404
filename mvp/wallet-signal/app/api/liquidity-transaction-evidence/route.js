import {NextResponse} from "next/server";
import {PublicKey} from "@solana/web3.js";
import {createReliableConnection} from "../../../lib/reliableConnection.js";
import {summarizePoolSignatures} from "../../../lib/liquidityTransactionEvidence.mjs";
import {inspectPumpAmmParsedTransaction} from "../../../lib/pumpAmmParsedTransactionEvidence.mjs";
import {classifyLiquidityRpcFailure} from "../../../lib/liquidityRpcFailure.mjs";
export const dynamic="force-dynamic";
export async function POST(request){
 let payload;
 try{payload=await request.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 let pool;
 try{pool=new PublicKey(payload?.poolAddress);if(pool.toBase58()!==payload.poolAddress)throw Error();}catch{return NextResponse.json({error:"Invalid pool address"},{status:400});}
 try{
  const connection=createReliableConnection({timeoutMs:8000,retries:1});
  const signatures=await connection.getSignaturesForAddress(pool,{limit:50},"confirmed");
  const summary=summarizePoolSignatures(signatures);
  const selected=summary.signatures.filter(s=>s.err===null).slice(0,10);
  const decoded=[];
  for(const entry of selected){
   try{
    const tx=await connection.getTransaction(entry.signature,{maxSupportedTransactionVersion:0,commitment:"confirmed"});
    decoded.push({signature:entry.signature,...inspectPumpAmmParsedTransaction(tx,pool.toBase58())});
   }catch(error){
    decoded.push({signature:entry.signature,status:"unavailable",errorCode:classifyLiquidityRpcFailure(error),candidateOperations:[],withdrawalConfirmed:false});
   }
  }
  return NextResponse.json({poolAddress:pool.toBase58(),observedAt:new Date().toISOString(),source:"Solana RPC getSignaturesForAddress + getTransaction",...summary,decodedTransactions:decoded,decodedCount:decoded.length,classificationComplete:false},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"unavailable",reason:"Transaction signature evidence unavailable"},{status:503});}
}
