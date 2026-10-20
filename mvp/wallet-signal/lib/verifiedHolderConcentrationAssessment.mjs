import {summarizeVerifiedHolderConnections} from "./verifiedHolderConnections.mjs";
import {summarizeHolderNetworkCheckpoint} from "./holderNetworkCheckpoint.mjs";
import {summarizeExternalHolderNetworkEvidence} from "./externalHolderNetworkEvidence.mjs";
import {scoreHolderIntelligence} from "./glitchAttributeEnginesV11.mjs";
/** v1.1 holder assessment. A finished evidence queue is NOT complete archival history. */
export function assessVerifiedHolderConcentration({checkpoint,evidenceRows=[],custodyClassificationComplete=false}={}){
 const graph=summarizeVerifiedHolderConnections({checkpoint,evidenceRows});
 const holders=checkpoint.holders||[];
 const validShares=holders.length===20&&holders.every(h=>typeof h.sharePct==="number"&&Number.isFinite(h.sharePct)&&h.sharePct>=0&&h.sharePct<=100);
 const ownerResolved=holders.length===20&&holders.every(h=>typeof h.ownerWallet==="string"&&h.ownerWallet.length>0);
 const uniqueAccounts=holders.every(h=>typeof h.tokenAccount==="string"&&h.tokenAccount.length>0)&&new Set(holders.map(h=>h.tokenAccount)).size===20;
 // Raw-backed shares are quantized to four decimals; avoid binary summation overflow at 100%.
 const totalShare=Math.round(holders.reduce((sum,h)=>sum+(typeof h.sharePct==="number"?h.sharePct:NaN),0)*10000)/10000;
 let rawEvidenceValid=false;
 const rawPresent=checkpoint.snapshot!==undefined||holders.some(h=>h.amountRaw!==undefined);
 if(rawPresent){
  const snapshot=checkpoint.snapshot;
  const uint=x=>typeof x==="string"&&/^\d+$/.test(x);
  const slot=x=>Number.isSafeInteger(x)&&x>=0;
  rawEvidenceValid=!!snapshot&&uint(snapshot.supplyRaw)&&BigInt(snapshot.supplyRaw)>0n&&holders.every(h=>uint(h.amountRaw))&&
   slot(snapshot.largestAccountsSlot)&&slot(snapshot.supplySlot)&&snapshot.supplySlot>=snapshot.largestAccountsSlot&&
   Array.isArray(snapshot.ownerSlots)&&snapshot.ownerSlots.length===holders.length&&snapshot.ownerSlots.every(s=>slot(s)&&s>=snapshot.supplySlot);
  if(rawEvidenceValid){
   const supply=BigInt(snapshot.supplyRaw);
   rawEvidenceValid=holders.reduce((sum,h)=>sum+BigInt(h.amountRaw),0n)<=supply&&holders.every(h=>Number(BigInt(h.amountRaw)*1000000n/supply)/10000===h.sharePct);
  }
 }
 const validSnapshot=validShares&&ownerResolved&&uniqueAccounts&&totalShare<=100&&rawEvidenceValid;
 const top20SharePct=validSnapshot?totalShare:undefined;
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
    c.id==="holder_breadth_independence"?"INDEPENDENCE_UNVERIFIED":!rawPresent?"SNAPSHOT_PROVENANCE_MISSING":"TOP20_DATA_INCOMPLETE"):undefined
 }));
 const possible=components.reduce((sum,c)=>sum+(c.score===null?0:c.max),0);
 const earned=Math.round(components.reduce((sum,c)=>sum+(c.score??0),0)*100)/100;
 return {...assessment,components,earned,possible,score:null,provisionalScore:null,
  status:!validSnapshot?"holder_data_incomplete":graph.evidenceComplete?"provisional_evidence_complete":"evidence_pending",
  evidence:graph,externalNetworkEvidence:summarizeExternalHolderNetworkEvidence({checkpoint,evidenceRows}),observedNetwork:summarizeHolderNetworkCheckpoint(checkpoint,{snapshotProvenanceVerified:validSnapshot}),snapshotProvenanceVerified:validSnapshot,historyComplete:false,scoreCoveragePct:possible,unscoredPoints:100-possible,
  provisionalScoreDenominator:possible,
  note:"GLITCH v1.1: no final score until history, creator linkage and custody coverage are verified."};
}
