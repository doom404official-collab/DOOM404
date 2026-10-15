import {buildEvidenceClusters,validateHolderSnapshot} from './concentrationEvidence.mjs';
import {scoreHolderConcentration} from './holderConcentrationScore.mjs';
// Pure adapter. Providers must supply a slot-consistent, independently completeness-checked snapshot.
// A 'complete' flag alone is not proof of full historical or current holder coverage.
export function assessHolderSnapshot({snapshot,transferEdges=[],creatorTeamWallets=[],excludedWallets=[],investigationComplete=false,creatorTeamVerified=false}) {
 const validation=validateHolderSnapshot(snapshot);
 if(!validation.valid) return {status:'unavailable',score:null,reason:validation.reason};
 const clusters=buildEvidenceClusters(transferEdges);
 const result=scoreHolderConcentration({
   holders:snapshot.holders,circulatingSupply:snapshot.circulatingSupply,
   connectedClusters:clusters,creatorTeamWallets,excludedWallets,investigationComplete,creatorTeamVerified
 });
 return {...result,snapshotSlot:snapshot.slot,clusterCount:clusters.length,
  dataProvenance:snapshot.source??'unspecified',
  coverageWarning:'Completeness and circulating-supply definition require independent provider verification.'};
}
