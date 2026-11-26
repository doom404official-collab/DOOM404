import {verifySignedBurnInstructionV2} from './creatorSignedBurnProofV2.mjs';
import {summarizeCreatorAcquisitionLedger} from './creatorAcquisitionLedger.mjs';
import {reconcileCreatorNonSaleOutflow} from './creatorOutflowReconciliation.mjs';
import {projectCreatorWalletObservation} from './creatorWalletObservation.mjs';
export function projectCreatorBehaviourV2(state,mint,creator){
 try{
  const e=state?.practicalScoringEvidenceV2;
  const current=e?projectCreatorWalletObservation({schemaVersion:1,provider:e.provider,network:'solana-mainnet',method:'getTokenAccountsByOwner',commitment:e.commitment,observedAt:e.observedAt,mint,creator,response:e.holdings},mint,creator):null;
  const events=[...(state.creatorVerifiedAcquisitionEvents||[])],signedBurnProofs=[];
  for(const tx of e?.targetedTransactions||[]){const r=reconcileCreatorNonSaleOutflow({mint,creator,signature:tx?.transaction?.signatures?.[0],transaction:tx});if(r.event){if(r.event.type==='VERIFIED_BURN'){if(!verifySignedBurnInstructionV2(tx))continue;signedBurnProofs.push({signature:r.signature,slot:r.slot,amountRaw:r.event.amountRaw,instructionSignatureVerified:true,executionEvidence:'finalized_rpc_balances'});}events.push(r.event);}}
  const ledger=summarizeCreatorAcquisitionLedger({mint,creator,events,historyComplete:false,attributionComplete:false});
  const rejected=new Set(ledger.rejected.map(r=>r.id));
  const signatures=[...new Set(events.filter(x=>x.independentlyVerified&&x.instructionVerified&&!rejected.has(x.signature+':'+x.instructionIndex+':'+String(x.innerInstructionIndex??'outer'))).map(x=>x.signature))];
  return {version:2,mint,creator,currentWallet:current,signedBurnProofs,ledger:{acceptedCount:ledger.acceptedCount,purchasedRaw:ledger.purchasedRaw,verifiedSoldRaw:ledger.verifiedSoldRaw,burnedRaw:ledger.burnedRaw,externalTransferredOutRaw:ledger.externalTransferredOutRaw,rejectedCount:ledger.rejected.length},signatures,
   processedHistoricalSignatures:Array.isArray(state.creatorProcessedSignatures)?state.creatorProcessedSignatures.length:0,
   historyComplete:false,archiveCoverageVerified:false,lifetimeSellingPct:null,
   recentDiscovery:e?{walletSignatures:e.walletSignatures?.length??0,tokenAccountSignatures:e.tokenAccountSignatures?.length??0,oldestReturnedTime:Math.min(...[...(e.walletSignatures||[]),...(e.tokenAccountSignatures||[])].map(s=>s.blockTime).filter(Number.isFinite)),budgetLimited:true}:null,
   limitations:['Verified sales, burns and external transfers are separate event classes.','Acquisition and selling histories are incomplete; no lifetime selling percentage or absence-of-sales claim.','Creator funding and previous launches remain unassessed unless individually attributed.']};
 }catch{return null;}
}
