import { observeCreatorTransaction } from './creatorTransactionEvidence.mjs';
import { verifyCreatorSwapSale } from './creatorSwapVerification.mjs';
import { assessPumpFunCreatorSellTransaction } from './pumpFunCreatorSellAssessment.mjs';
import { corroborateHistoricalCreatorSellPath } from './creatorHistoricalSellPath.mjs';
import { verifyPumpFunCreatorSettlement } from './pumpFunCreatorSettlement.mjs';
/** Decode a bounded batch of discovered signatures. Failed fetches stay pending.
 * This does not claim swap verification or archival completeness.
 */
export async function inspectCreatorHistoricalBatch({mint,creator,signatures=[],rpc,maxTransactions=20,swapDecoder=null,settlementDecoder=null}={}){
 if(typeof rpc?.fetchTransaction!=='function'||!Array.isArray(signatures)||!Number.isInteger(maxTransactions)||maxTransactions<1||maxTransactions>100)throw Error('INVALID_CREATOR_BATCH');
 const observations=[],processed=[],pending=[],verifiedSales=[],sellCandidates=[];
 for(const signature of [...new Set(signatures)].slice(0,maxTransactions)){
  try{
   const tx=await rpc.fetchTransaction(signature);
   if(!tx){pending.push(signature);continue;}
   observations.push(observeCreatorTransaction({signature,transaction:tx,creator,mint}));
   const candidate=assessPumpFunCreatorSellTransaction({mint,creator,signature,transaction:tx});
   if(candidate.status==='SETTLEMENT_REVIEW_PENDING'){
    const path=corroborateHistoricalCreatorSellPath({mint,creator,transaction:tx});
    sellCandidates.push({signature,status:path.status==='HISTORICAL_CREATOR_TOKEN_PATH_CORROBORATED'?'HISTORICAL_SETTLEMENT_REVIEW_PENDING':'SOURCE_OWNERSHIP_UNVERIFIED',saleVerified:false});
    if(path.status==='HISTORICAL_CREATOR_TOKEN_PATH_CORROBORATED' && typeof settlementDecoder==='function'){
     const settlement=await settlementDecoder({mint,creator,signature,transaction:tx,candidate,path});
     const proof=verifyPumpFunCreatorSettlement({candidate:{...candidate,status:'CORROBORATED_CANDIDATE',saleVerified:false},settlement});
     if(proof.status==='VERIFIED')verifiedSales.push(proof.sale);
    }
   }
   if(swapDecoder){
    const proof=verifyCreatorSwapSale({mint,creator,signature,transaction:tx,decoder:swapDecoder});
    if(proof.status==='VERIFIED')verifiedSales.push(proof.sale);
   }
   processed.push(signature);
  }catch(error){
   if(['CREATOR_REQUEST_BUDGET_EXHAUSTED','RPC_REQUEST_BUDGET_EXHAUSTED'].includes(error?.message)){pending.push(signature);break;}
   pending.push(signature);
  }
 }
 return {observations,processed,pending,verifiedSales,sellCandidates,historicalCoverageComplete:false};
}
