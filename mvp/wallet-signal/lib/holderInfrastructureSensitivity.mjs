import {readFrozenHolderSnapshot} from './frozenHolderSnapshot.mjs';
import {scoreTop20Network} from "./top20NetworkScore.mjs";
// Scenario-only comparison. Never mutates the frozen snapshot or promotes a score.
export function compareHolderInfrastructureExclusion({snapshot,transfers,pool}={}){
 if(!snapshot||snapshot.status!=="frozen"||!Array.isArray(snapshot.holder_ranking)||snapshot.holder_ranking.length!==20||!Array.isArray(snapshot.excluded_wallets)||!Array.isArray(transfers)||typeof pool!=="string")throw Error("INVALID_SENSITIVITY_INPUT");
 if(!snapshot.holder_ranking.some(h=>h.wallet===pool)||snapshot.excluded_wallets.includes(pool))throw Error("POOL_NOT_ELIGIBLE_IN_BASELINE");
 const {holders,snapshotIdentity}=readFrozenHolderSnapshot(snapshot);
 const run=excluded=>scoreTop20Network({holders,transfers,supplyRaw:snapshot.supply_raw,infrastructureWallets:excluded});
 const baseline=run(snapshot.excluded_wallets);
 const excluded=run([...snapshot.excluded_wallets,pool]);
 return {status:"OBSERVED_ONLY",snapshotId:snapshot.id,snapshotIdentity,pool,eligibleHolderCounts:{baseline:holders.filter(h=>!snapshot.excluded_wallets.includes(h.wallet)).length,excluded:holders.filter(h=>h.wallet!==pool&&!snapshot.excluded_wallets.includes(h.wallet)).length},replacementApplied:false,baseline,excluded,delta:{score:Math.round((excluded.score-baseline.score)*100)/100,connectedHolders:excluded.evidence.connectedHolderCount-baseline.evidence.connectedHolderCount,largestClusterPct:Math.round((excluded.evidence.largestClusterPct-baseline.evidence.largestClusterPct)*100)/100,directPairs:excluded.evidence.directPairs-baseline.evidence.directPairs},historyComplete:false,scorePromoted:false,snapshotModified:false,warning:"Scenario sensitivity is not authorization to change scoring or historical classification."};
}
