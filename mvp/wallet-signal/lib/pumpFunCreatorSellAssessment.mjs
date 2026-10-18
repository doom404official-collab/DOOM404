import {verifyPumpFunCreatorSellCandidate} from './pumpFunCreatorSellCorroboration.mjs';
import {corroboratePumpFunSolPayment} from './pumpFunSolPaymentCorroboration.mjs';
import {corroboratePumpFunPoolReceipt} from './pumpFunPoolReceiptCorroboration.mjs';
/** Aggregate Pump.fun sell evidence without claiming final settlement.
 * Requires protocol-specific instruction linkage and pool token receipt proof next.
 */
export function assessPumpFunCreatorSellTransaction({mint,creator,signature,transaction}={}){
 const candidate=verifyPumpFunCreatorSellCandidate({mint,creator,signature,transaction});
 if(candidate.status!=='CORROBORATED_CANDIDATE')
 return {status:'UNVERIFIED',reason:candidate.reason||'SELL_CANDIDATE_NOT_CORROBORATED'};
 const payment=corroboratePumpFunSolPayment({mint,creator,transaction});
 if(payment.status!=='POOL_SOL_PAYMENT_OBSERVED')
 return {status:'UNVERIFIED',reason:'POOL_PAYMENT_NOT_CORROBORATED'};
 const receipt=corroboratePumpFunPoolReceipt({mint,transaction});
 if(receipt.status!=='POOL_RECEIPT_CORROBORATED')
 return {status:'UNVERIFIED',reason:'POOL_TOKEN_RECEIPT_NOT_CORROBORATED'};
 if(BigInt(receipt.poolReceivedRaw)<BigInt(candidate.soldRaw))
 return {status:'UNVERIFIED',reason:'POOL_RECEIPT_BELOW_CLAIMED_SALE'};
 return {status:'SETTLEMENT_REVIEW_PENDING',signature,mint,creator,soldRaw:candidate.soldRaw,
  poolTokenAccount:receipt.poolTokenAccount,poolReceivedRaw:receipt.poolReceivedRaw,
  pool:payment.pool,creatorReceivedLamports:payment.transferLamports,
  poolTokenReceiptVerified:false,transactionInstructionLinked:false,
  independentlyVerified:false,saleVerified:false};
}
