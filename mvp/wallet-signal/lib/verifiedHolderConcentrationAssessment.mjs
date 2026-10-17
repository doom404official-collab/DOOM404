import {summarizeVerifiedHolderConnections} from "./verifiedHolderConnections.mjs";
import {scoreHolderIntelligence} from "./glitchAttributeEnginesV11.mjs";
/** v1.1 holder assessment. A finished evidence queue is NOT complete archival history. */
export function assessVerifiedHolderConcentration({checkpoint,evidenceRows=[],custodyClassificationComplete=false}={}){
 const graph=summarizeVerifiedHolderConnections({checkpoint,evidenceRows});
 const holders=checkpoint.holders||[];
 const validShares=holders.length===20&&holders.every(h=>typeof h.sharePct==="number"&&Number.isFinite(h.sharePct)&&h.sharePct>=0&&h.sharePct<=100);
 const ownerResolved=holders.length===20&&holders.every(h=>typeof h.ownerWallet==="string"&&h.ownerWallet.length>0);
 const top20SharePct=validShares?holders.reduce((sum,h)=>sum+h.sharePct,0):undefined;
 // Graph evidence establishes observed connections, not history exhaustion.
 // The authoritative 35-point network scorer must provide its independently
 // validated result before this component can be numerically populated.
 const assessment=scoreHolderIntelligence({
  top20SharePct,
  networkScore:undefined,
  creatorTeamExposurePct:undefined,
  independencePoints:undefined,
  historyComplete:false,
  classificationComplete:custodyClassificationComplete&&ownerResolved,
  creatorAttributionComplete:false
 });
 const components=assessment.components.map(c=>({
  ...c,score:c.points,
  reason:c.points===null?(c.id==="connected_wallet_network"?"HISTORICAL_COVERAGE_UNVERIFIED":
    c.id==="creator_team_exposure"?"CREATOR_LINKAGE_UNVERIFIED":
    c.id==="holder_breadth_independence"?"INDEPENDENCE_UNVERIFIED":"TOP20_DATA_INCOMPLETE"):undefined
 }));
 const possible=components.reduce((sum,c)=>sum+(c.score===null?0:c.max),0);
 const earned=Math.round(components.reduce((sum,c)=>sum+(c.score??0),0)*100)/100;
 return {...assessment,components,earned,possible,score:null,provisionalScore:null,
  status:!validShares||!ownerResolved?"holder_data_incomplete":graph.evidenceComplete?"provisional_evidence_complete":"evidence_pending",
  evidence:graph,historyComplete:false,scoreCoveragePct:possible,unscoredPoints:100-possible,
  provisionalScoreDenominator:possible,
  note:"GLITCH v1.1: no final score until history, creator linkage and custody coverage are verified."};
}
