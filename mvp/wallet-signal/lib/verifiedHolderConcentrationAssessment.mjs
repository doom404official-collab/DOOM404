import {summarizeVerifiedHolderConnections} from "./verifiedHolderConnections.mjs";
import {scoreHolderConcentration} from "./holderConcentrationScore.mjs";
/** Evidence-gated holder assessment. A partial history must not be marketed as a final risk score. */
export function assessVerifiedHolderConcentration({checkpoint,evidenceRows=[],custodyClassificationComplete=false}={}){
 const graph=summarizeVerifiedHolderConnections({checkpoint,evidenceRows});
 const holders=checkpoint.holders||[];
 const validShares=holders.length>0&&holders.every(h=>typeof h.sharePct==="number"&&Number.isFinite(h.sharePct)&&h.sharePct>=0&&h.sharePct<=100);
 const ownerResolved=holders.length>0&&holders.every(h=>typeof h.ownerWallet==="string"&&h.ownerWallet.length>0);
 const holderDataReady=validShares&&ownerResolved;
 const top20SharePct=holders.reduce((sum,h)=>sum+(Number(h.sharePct)||0),0);
 const largestAccountSharePct=holders.length?Math.max(...holders.map(h=>Number(h.sharePct)||0)):null;
 const ownerWalletsResolved=new Set(holders.map(h=>h.ownerWallet).filter(Boolean)).size;
 const assessment=scoreHolderConcentration({
  top20SharePct,largestAccountSharePct,holders,
  connectedGroups:graph.connectedGroups,directPairs:graph.directPairs,
  connectedWallets:graph.connectedWallets,ownerWalletsResolved,
  walletHistoriesReached:Object.values(checkpoint.wallets||{}).filter(w=>w.pages>0).length,
  custodyClassificationComplete,historyComplete:false
 });
 const components=assessment.components.map(c=>{
  if(!holderDataReady&&["top20","largest","connections","combined","integrity"].includes(c.id))return {...c,score:null,reason:"HOLDER_DATA_INCOMPLETE"};
  if(["connections","combined"].includes(c.id)&&!graph.evidenceComplete)return {...c,score:null,reason:"EVIDENCE_PENDING"};
  if(c.id==="integrity"&&!custodyClassificationComplete)return {...c,score:null,reason:"CUSTODY_UNCLASSIFIED"};
  return c;
 });
 const possible=components.reduce((sum,c)=>sum+(c.score===null?0:c.max),0);
 const earned=Math.round(components.reduce((sum,c)=>sum+(c.score??0),0)*100)/100;
 return {...assessment,components,earned,possible,score:null,provisionalScore:graph.evidenceComplete&&holderDataReady?earned:null,
  status:!holderDataReady?"holder_data_incomplete":graph.evidenceComplete?"provisional_evidence_complete":"evidence_pending",
  evidence:graph,scoreCoveragePct:Math.round(possible),unscoredPoints:100-possible,
  provisionalScoreDenominator:possible,
  note:"Evidence-queue completion is not complete historical coverage. No final customer-facing score is issued."};
}
