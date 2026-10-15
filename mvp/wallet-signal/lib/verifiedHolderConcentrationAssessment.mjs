import {summarizeVerifiedHolderConnections} from "./verifiedHolderConnections.mjs";
import {scoreHolderConcentration} from "./holderConcentrationScore.mjs";
/** Evidence-gated holder assessment. A partial history must not be marketed as a final risk score. */
export function assessVerifiedHolderConcentration({checkpoint,evidenceRows=[],custodyClassificationComplete=false}={}){
 const graph=summarizeVerifiedHolderConnections({checkpoint,evidenceRows});
 const holders=checkpoint.holders||[];
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
 const components=assessment.components.map(c=>
  ["connections","combined"].includes(c.id)&&!graph.evidenceComplete?{...c,score:null,reason:"EVIDENCE_PENDING"}:c);
 const possible=components.reduce((sum,c)=>sum+(c.score===null?0:c.max),0);
 const earned=Math.round(components.reduce((sum,c)=>sum+(c.score??0),0)*100)/100;
 return {...assessment,components,earned,possible,score:null,provisionalScore:graph.evidenceComplete?earned:null,
  status:graph.evidenceComplete?"provisional_evidence_complete":"evidence_pending",
  evidence:graph,
  note:"Evidence-queue completion is not complete historical coverage. No final customer-facing score is issued."};
}
