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
import {extractFeeSweepAccounts} from "../../../lib/liquidityFeeSweepAccounts.mjs";
import {inspectFeeSettlementTransfers} from "../../../lib/liquidityFeeSettlementTransfers.mjs";
import {assessFeeSettlement} from "../../../lib/liquidityFeeSettlementAssessment.mjs";
import {assessFeeRecipientAuthorization} from "../../../lib/liquidityFeeRecipientAuthorization.mjs";
import {assessHistoricalFeeAuthorization} from "../../../lib/liquidityHistoricalFeeAuthorization.mjs";
import {historicalFeeStateRequirements} from "../../../lib/liquidityHistoricalStateRequirements.mjs";
import {inspectCreatorUpdateInstructions} from "../../../lib/liquidityCreatorUpdateEvidence.mjs";
import {reviewCreatorFeeRouting} from "../../../lib/liquidityCreatorFeeRoutingReview.mjs";
import {inspectSharingConfigReferences} from "../../../lib/liquiditySharingConfigEvidence.mjs";
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
  const requestedSignature=payload?.signature;
  if(requestedSignature!==undefined&&(typeof requestedSignature!=="string"||!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(requestedSignature)))return NextResponse.json({error:"Invalid transaction signature"},{status:400});
  const selected=requestedSignature?[{signature:requestedSignature,err:null}]:selection.selected;
  const decoded=[];
  for(const entry of selected){
   try{
    const retrieval=await retrieveLiquidityTransaction(entry.signature,{primaryConnection:connection});
    if(retrieval.error){decoded.push({signature:entry.signature,status:"unavailable",...describeLiquidityRpcFailure(retrieval.error),versionProbe:inspectVersionRejection(retrieval.error),fallbackAttempted:retrieval.fallbackAttempted,fallbackSkipped:retrieval.fallbackSkipped??null,primaryErrorCode:retrieval.primaryError?describeLiquidityRpcFailure(retrieval.primaryError).errorCode:null,provider:retrieval.provider,candidateOperations:[],withdrawalConfirmed:false});continue;}
    const tx=retrieval.transaction;
    const message=tx?.transaction?.message;
    const keys=[...(message?.staticAccountKeys??message?.accountKeys??[]),...(tx?.meta?.loadedAddresses?.writable??[]),...(tx?.meta?.loadedAddresses?.readonly??[])].map(k=>typeof k==="string"?k:k?.pubkey?.toBase58?.()??k?.toBase58?.()??String(k));
    const instructionEvidence=inspectPumpAmmParsedTransaction(tx,pool.toBase58());
    const vaultBalanceEvidence=calculateVaultTransactionDeltas(tx?.meta,keys,vaultAddresses);
    const feeSweepAccounts=extractFeeSweepAccounts(tx,pool.toBase58());
    const feeSettlementTransfers=inspectFeeSettlementTransfers(tx,feeSweepAccounts);
    const feeSettlementAssessment=assessFeeSettlement({sweepAccounts:feeSweepAccounts,transferEvidence:feeSettlementTransfers,vaultBalanceEvidence});
    const feeRecipientAuthorization=assessFeeRecipientAuthorization(feeSweepAccounts.sweeps);
    const historicalFeeAuthorization=assessHistoricalFeeAuthorization({transactionSlot:tx?.slot,feeSweeps:feeSweepAccounts.sweeps});
    const historicalStateRequirements=historicalFeeStateRequirements({transactionSlot:tx?.slot,feeSweeps:feeSweepAccounts.sweeps});
    const creatorUpdateEvidence=inspectCreatorUpdateInstructions(tx,pool.toBase58());
    const sharingConfigReferences=inspectSharingConfigReferences(tx,pool.toBase58());
    const creatorFeeRecipient=feeSweepAccounts.sweeps.find(s=>s.poolMatched&&s.operation==="sweep_creator_fee")?.recipient??null;
    const creatorFeeRoutingReview=reviewCreatorFeeRouting({feeRecipient:creatorFeeRecipient,creatorUpdateEvidence});
    decoded.push({signature:entry.signature,retrievalProvider:retrieval.provider,fallbackUsed:retrieval.fallbackUsed,fallbackAttempted:retrieval.fallbackAttempted,...instructionEvidence,vaultBalanceEvidence,swapDirectionEvidence:assessSwapReserveDirection(instructionEvidence.candidateOperations,vaultBalanceEvidence),ambiguityDiagnostics:diagnoseSwapAmbiguity(instructionEvidence.candidateOperations,vaultBalanceEvidence),transactionRelevance:assessPoolTransactionRelevance(instructionEvidence.candidateOperations,vaultBalanceEvidence),feeSweepAccounts,feeSettlementTransfers,feeSettlementAssessment,feeRecipientAuthorization,historicalFeeAuthorization,historicalStateRequirements,creatorUpdateEvidence,creatorFeeRoutingReview,sharingConfigReferences});
   }catch(error){
    decoded.push({signature:entry.signature,status:"unavailable",...describeLiquidityRpcFailure(error),versionProbe:inspectVersionRejection(error),candidateOperations:[],withdrawalConfirmed:false});
   }
  }
  return NextResponse.json({poolAddress:pool.toBase58(),observedAt:new Date().toISOString(),source:"Solana RPC getSignaturesForAddress + getTransaction",...summary,decodedTransactions:decoded,decodedCount:decoded.length,excludedSignatures:selection.excludedCount,focusedSignature:requestedSignature??null,classificationComplete:false},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"unavailable",reason:"Transaction signature evidence unavailable"},{status:503});}
}
