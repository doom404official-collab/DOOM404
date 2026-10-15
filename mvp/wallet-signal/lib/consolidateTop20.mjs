import {analyzeHolderNetwork} from './holderRelationshipNetwork.mjs';
import {summarizeHolderNetworkExposure} from './holderNetworkExposure.mjs';
import {scoreTop20Network} from './top20NetworkScore.mjs';
// Merge only on-chain verified transfer evidence. A transfer is not proof of common ownership.
export function consolidateTop20({snapshot,batches,infrastructureWallets=[],creatorWallets=[]}={}){
 const holders=snapshot?.holder_ranking;
 const supply=Number(snapshot?.supply_raw);
 if(!Array.isArray(holders)||holders.length!==20||!Number.isFinite(supply)||supply<=0)
  throw new TypeError('Valid frozen ranking and supply required');
 const offsets=[0,5,10,15];
 if(!Array.isArray(batches)||batches.length!==4||
  offsets.some(offset=>batches.filter(b=>b.start_index===offset).length!==1))
  throw new Error('All four distinct batches required');
 const records=[];
 for(const offset of offsets){
  const batch=batches.find(b=>b.start_index===offset);
  if(!['partial','complete'].includes(batch.status)||!Array.isArray(batch.wallet_results)||batch.wallet_results.length!==5)
   throw new Error('Incomplete batch records');
  for(let i=0;i<5;i++){
   const r=batch.wallet_results[i];
   if(r.wallet!==holders[offset+i].wallet)throw new Error('Holder ranking mismatch');
   records.push(r);
  }
 }
 const unique=new Map();
 for(const r of records)for(const e of r.edges??[]){
  if(e.verifiedOnChain!==true||e.transferVerified!==true)continue;
  const key=[e.signature,e.from,e.to,e.assetType,e.mint??'',e.lamports??'',e.amount??''].join('|');
  if(!unique.has(key))unique.set(key,e);
 }
 const transfers=[...unique.values()];
 const exclusions=new Set(infrastructureWallets);
 const eligibleHolders=holders.filter(h=>!exclusions.has(h.wallet));
 const eligibleTransfers=transfers.filter(t=>!exclusions.has(t.from)&&!exclusions.has(t.to));
 const network=analyzeHolderNetwork({holders:eligibleHolders,transfers:eligibleTransfers,infrastructureWallets,creatorWallets});
 const exposure=summarizeHolderNetworkExposure({holders:eligibleHolders,network,circulatingSupply:supply});
 const networkScore=scoreTop20Network({holders:eligibleHolders,transfers:eligibleTransfers,network,exposure,
  historyCoverage:records.map(r=>({wallet:r.wallet,decoded:r.coverage?.decoded??0,failed:r.coverage?.failed??0}))});
 return {status:'provisional',snapshotId:snapshot.id,slot:snapshot.snapshot_slot,
  supplyDefinition:'mint-total-supply-not-circulating',holdersSampled:records.length,
  partialBatches:batches.filter(b=>b.status==='partial').length,
  rawTransferRecords:records.reduce((n,r)=>n+(r.edges?.length??0),0),
  deduplicatedVerifiedTransfers:transfers.length,
  excludedInfrastructureWalletCount:holders.length-eligibleHolders.length,
  eligibleHoldersScored:eligibleHolders.length,
  networkScore,
  network:{connectedHolderCount:network.connectedHolderCount,directHolderCount:network.directHolderCount,
   excludedHighDegreeHubCount:network.excludedHighDegreeHubCount},
  exposure:{connectedSupplyPct:exposure.connectedSupplyPct,largestClusterPct:exposure.largestClusterPct,
   creatorLinkedSupplyPct:exposure.creatorLinkedSupplyPct},
  note:'Top-20 only, bounded historical samples; no connection found does not prove independence.'};
}
