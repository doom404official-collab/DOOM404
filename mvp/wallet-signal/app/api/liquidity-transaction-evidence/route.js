import {NextResponse} from "next/server";
import {PublicKey} from "@solana/web3.js";
import {createReliableConnection} from "../../../lib/reliableConnection.js";
import {summarizePoolSignatures} from "../../../lib/liquidityTransactionEvidence.mjs";
import {inspectPumpAmmParsedTransaction} from "../../../lib/pumpAmmParsedTransactionEvidence.mjs";
import {describeLiquidityRpcFailure} from "../../../lib/liquidityRpcFailure.mjs";
import {inspectVersionRejection} from "../../../lib/liquidityVersionProbe.mjs";
import {calculateVaultTransactionDeltas} from "../../../lib/liquidityVaultTransactionDeltas.mjs";
import {assessSwapReserveDirection} from "../../../lib/liquiditySwapDirection.mjs";
import {diagnoseSwapAmbiguity} from "../../../lib/liquidityAmbiguityDiagnostics.mjs";
import {assessPoolTransactionRelevance} from "../../../lib/liquidityTransactionRelevance.mjs";
import {selectLiquidityTransactionSignatures} from "../../../lib/liquidityTransactionSelection.mjs";
import {retrieveLiquidityTransaction} from "../../../lib/liquidityRpcVersionFallback.mjs";
export const dynamic="force-dynamic";
export async function POST(request){
 let payload;
 try{payload=await request.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 let pool;
 try{pool=new PublicKey(payload?.poolAddress);if(pool.toBase58()!==payload.poolAddress)throw Error();}catch{return NextResponse.json({error:"Invalid pool address"},{status:400});}
 const vaultAddresses=payload?.vaultAddresses??[];
 if(!Array.isArray(vaultAddresses)||vaultAddresses.length>2||vaultAddresses.some(a=>{try{return new PublicKey(a).toBase58()!==a;}catch{return true;}}))return NextResponse.json({error:"Invalid vault addresses"},{status:400});
 try{
  const connection=createReliableConnection({timeoutMs:8000,retries:1});
  const signatures=await connection.getSignaturesForAddress(pool,{limit:50},"confirmed");
  const summary=summarizePoolSignatures(signatures);
  const selection=selectLiquidityTransactionSignatures(summary.signatures,{limit:10,exclude:Array.isArray(payload?.excludeSignatures)?payload.excludeSignatures:[]});
  const selected=selection.selected;
  const decoded=[];
  for(const entry of selected){
   try{
    const retrieval=await retrieveLiquidityTransaction(entry.signature,{primaryConnection:connection});
    if(retrieval.error)throw retrieval.error;
    const tx=retrieval.transaction;
    const message=tx?.transaction?.message;
    const keys=[...(message?.staticAccountKeys??message?.accountKeys??[]),...(tx?.meta?.loadedAddresses?.writable??[]),...(tx?.meta?.loadedAddresses?.readonly??[])].map(k=>typeof k==="string"?k:k?.pubkey?.toBase58?.()??k?.toBase58?.()??String(k));
    const instructionEvidence=inspectPumpAmmParsedTransaction(tx,pool.toBase58());
    const vaultBalanceEvidence=calculateVaultTransactionDeltas(tx?.meta,keys,vaultAddresses);
    decoded.push({signature:entry.signature,retrievalProvider:retrieval.provider,fallbackUsed:retrieval.fallbackUsed,...instructionEvidence,vaultBalanceEvidence,swapDirectionEvidence:assessSwapReserveDirection(instructionEvidence.candidateOperations,vaultBalanceEvidence),ambiguityDiagnostics:diagnoseSwapAmbiguity(instructionEvidence.candidateOperations,vaultBalanceEvidence),transactionRelevance:assessPoolTransactionRelevance(instructionEvidence.candidateOperations,vaultBalanceEvidence)});
   }catch(error){
    decoded.push({signature:entry.signature,status:"unavailable",...describeLiquidityRpcFailure(error),versionProbe:inspectVersionRejection(error),candidateOperations:[],withdrawalConfirmed:false});
   }
  }
  return NextResponse.json({poolAddress:pool.toBase58(),observedAt:new Date().toISOString(),source:"Solana RPC getSignaturesForAddress + getTransaction",...summary,decodedTransactions:decoded,decodedCount:decoded.length,excludedSignatures:selection.excludedCount,classificationComplete:false},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"unavailable",reason:"Transaction signature evidence unavailable"},{status:503});}
}
