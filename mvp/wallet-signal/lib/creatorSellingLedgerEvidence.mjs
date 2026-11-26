import {summarizeCreatorAcquisitionLedger} from './creatorAcquisitionLedger.mjs';
import {CREATOR_SELL_WINDOWS} from './creatorSellingEvidence.mjs';
/** Versioned selling denominator for verified acquisitions, including paid launch
 * purchases when direct launch issuance is zero. Scoring weights are unchanged.
 * Each window uses acquisitions observed by its endpoint, never later purchases.
 */
export function summarizeCreatorSellingLedger({mint,creator,launchTimestamp,events=[],historyCompleteByWindow={},archiveVerified=false,attributionComplete=false}={}){
 if(!Number.isSafeInteger(launchTimestamp)||launchTimestamp<=0||!Array.isArray(events))throw Error('INVALID_CREATOR_SELLING_LEDGER');
 const windows=CREATOR_SELL_WINDOWS.map(seconds=>{
  const historyComplete=archiveVerified===true&&historyCompleteByWindow[seconds]===true;
  const ledger=summarizeCreatorAcquisitionLedger({mint,creator,events:events.filter(e=>Number.isSafeInteger(e?.timestamp)&&e.timestamp>=launchTimestamp&&e.timestamp<=launchTimestamp+seconds),historyComplete,attributionComplete});
  return {seconds,denominatorRaw:ledger.totalAcquiredRaw,verifiedSoldRaw:ledger.verifiedSoldRaw,burnedRaw:ledger.burnedRaw,externalTransferredOutRaw:ledger.externalTransferredOutRaw,
   historyComplete,scoreEligible:ledger.scoreEligible,sellThroughPct:ledger.scoreEligible?ledger.sellThroughPct:null};
 });
 return {methodology:'CREATOR_SELLING_LEDGER_V2',denominatorDefinition:'Verified acquisitions through each window endpoint; burns and external transfers are not sales',windows,creatorSellingScoreEligible:windows.every(w=>w.scoreEligible),archiveVerified:archiveVerified===true};
}
