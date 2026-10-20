import { observeCreatorTransaction } from './creatorTransactionEvidence.mjs';
import { verifyCreatorSwapSale } from './creatorSwapVerification.mjs';
import { assessPumpFunCreatorSellTransaction } from './pumpFunCreatorSellAssessment.mjs';
import { corroborateHistoricalCreatorSellPath } from './creatorHistoricalSellPath.mjs';
import { verifyPumpFunCreatorSettlement } from './pumpFunCreatorSettlement.mjs';
import { extractPumpFunSettlementEvidence } from './pumpFunSettlementEvidenceExtractor.mjs';
import { observeCreatorAcquisitionMovements } from './creatorAcquisitionMovements.mjs';
import { classifyCreatorTransferDirections } from './creatorTransferDirectionClassifier.mjs';
import { promotePumpFunCreatorBuy } from './pumpFunCreatorBuyPromotion.mjs';
import { inspectPumpFunBuyShadow } from './pumpFunBuyShadowValidation.mjs';
/** Decode a bounded batch of discovered signatures. Failed fetches stay pending.
 * This does not claim swap verification or archival completeness.
 */
export async function inspectCreatorHistoricalBatch({mint,creator,signatures=[],rpc,maxTransactions=20,swapDecoder=null,settlementDecoder=extractPumpFunSettlementEvidence,buySettlementDecoder=null}={}){
 if(typeof rpc?.fetchTransaction!=='function'||!Array.isArray(signatures)||!Number.isInteger(maxTransactions)||maxTransactions<1||maxTransactions>100)throw Error('INVALID_CREATOR_BATCH');
 const observations=[],processed=[],pending=[],verifiedSales=[],sellCandidates=[],acquisitionMovements=[],transferDirections=[],verifiedAcquisitionEvents=[],buyShadowResults=[];
 for(const signature of [...new Set(signatures)].slice(0,maxTransactions)){
  try{
   const tx=await rpc.fetchTransaction(signature);
   if(!tx){pending.push(signature);continue;}
   observations.push(observeCreatorTransaction({signature,transaction:tx,creator,mint}));
   acquisitionMovements.push(...observeCreatorAcquisitionMovements({mint,creator,signature,transaction:tx}).movements);
   transferDirections.push(...classifyCreatorTransferDirections({mint,creator,signature,transaction:tx}));
   const shadow=inspectPumpFunBuyShadow({mint,creator,signature,transaction:tx});
   if(shadow.status!=='NO_VERIFIED_BUY_EVIDENCE')buyShadowResults.push(shadow);
   if(typeof buySettlementDecoder==='function'){
    const independentSettlement=await buySettlementDecoder({mint,creator,signature,transaction:tx});
    const promoted=promotePumpFunCreatorBuy({mint,creator,signature,transaction:tx,independentSettlement});
    if(promoted.status==='VERIFIED')verifiedAcquisitionEvents.push(promoted.event);
   }
   const candidate=assessPumpFunCreatorSellTransaction({mint,creator,signature,transaction:tx});
   if(candidate.status==='SETTLEMENT_REVIEW_PENDING'){
    const path=corroborateHistoricalCreatorSellPath({mint,creator,transaction:tx});
    const extracted=path.status==='HISTORICAL_CREATOR_TOKEN_PATH_CORROBORATED'?
     extractPumpFunSettlementEvidence({mint,creator,signature,transaction:tx}):null;
    sellCandidates.push({signature,status:extracted?'POOL_OWNERSHIP_REVIEW_PENDING':path.status==='HISTORICAL_CREATOR_TOKEN_PATH_CORROBORATED'?'HISTORICAL_SETTLEMENT_REVIEW_PENDING':'SOURCE_OWNERSHIP_UNVERIFIED',saleVerified:false});
    if(path.status==='HISTORICAL_CREATOR_TOKEN_PATH_CORROBORATED' && typeof settlementDecoder==='function'){
     const settlement=await settlementDecoder({mint,creator,signature,transaction:tx,candidate,path});
     const proof=verifyPumpFunCreatorSettlement({candidate:{status:'CORROBORATED_CANDIDATE',saleVerified:false,signature,creator,mint,soldRaw:candidate.soldRaw},settlement});
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
 return {observations,processed,pending,verifiedSales,sellCandidates,acquisitionMovements,transferDirections,verifiedAcquisitionEvents,buyShadowResults,historicalCoverageComplete:false};
}
