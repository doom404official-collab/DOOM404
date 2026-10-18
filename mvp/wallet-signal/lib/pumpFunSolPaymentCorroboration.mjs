import {derivePumpFunBondingCurveAccounts} from './pumpFunBondingCurveDerivation.mjs';
import {identifyCreatorSolTransferCandidates} from './creatorPoolSolTransfers.mjs';
import {observeCreatorSolReceipt} from './creatorSolReceiptObservation.mjs';
/** Correlate pool-to-creator SOL transfer with creator balance delta.
 * Not a final swap settlement proof until instruction and pool token receipt are verified.
 */
export function corroboratePumpFunSolPayment({mint,creator,transaction}={}){
 const derived=derivePumpFunBondingCurveAccounts({mint});
 if(derived.status!=='DERIVED')return {status:'UNVERIFIED',reason:'INVALID_MINT'};
 const transfers=identifyCreatorSolTransferCandidates({transaction,creator,pool:derived.bondingCurve});
 const receipt=observeCreatorSolReceipt({transaction,creator});
 const paid=transfers.reduce((sum,x)=>sum+BigInt(x.lamports),0n);
 if(paid<=0n||receipt.status!=='NET_SOL_INCREASE_OBSERVED')
 return {status:'UNVERIFIED',reason:'POOL_PAYMENT_NOT_CORROBORATED'};
 return {status:'POOL_SOL_PAYMENT_OBSERVED',pool:derived.bondingCurve,
  transferLamports:paid.toString(),creatorNetSolLamports:receipt.netLamports,
  linkedToSellInstructionVerified:false,settlementVerified:false};
}
