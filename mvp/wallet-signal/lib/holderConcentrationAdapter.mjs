import {buildEvidenceClusters,validateHolderSnapshot} from './concentrationEvidence.mjs';
import {scoreHolderConcentration} from './holderConcentrationScore.mjs';
// Pure adapter. Providers must supply a slot-consistent, independently completeness-checked snapshot.
// A 'complete' flag alone is not proof of full historical or current holder coverage.
export function assessHolderSnapshot({snapshot,transferEdges=[],creatorTeamWallets=[],excludedWallets=[],investigationComplete=false,creatorTeamVerified=false}) {
 const validation=validateHolderSnapshot(snapshot);
 if(!validation.valid) return {status:'unavailable',score:null,reason:validation.reason};
 const clusters=buildEvidenceClusters(transferEdges);
 const supplyVerified=snapshot.supplyDefinition==='verified-circulating-supply' && snapshot.supplyVerified===true;
 const coverageVerified=snapshot.coverageVerified===true;
 const exclusionsVerified=snapshot.exclusionsVerified===true;
 const canFinalize=supplyVerified && coverageVerified && exclusionsVerified;
 const result=scoreHolderConcentration({
   holders:snapshot.holders,circulatingSupply:snapshot.circulatingSupply,
   connectedClusters:clusters,creatorTeamWallets,excludedWallets,investigationComplete:canFinalize && investigationComplete,creatorTeamVerified:canFinalize && creatorTeamVerified
 });
 return {...result,snapshotSlot:snapshot.slot,clusterCount:clusters.length,
  dataProvenance:snapshot.source??'unspecified',
  verification:{supplyVerified,coverageVerified,exclusionsVerified},
  coverageWarning:canFinalize ? null : 'Final scoring blocked until circulating supply, holder coverage and exclusions are independently verified.'};
}
