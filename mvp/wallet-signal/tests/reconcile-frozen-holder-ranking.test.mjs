import test from "node:test";
import assert from "node:assert/strict";
import {reconcileFrozenHolderRanking} from "../lib/reconcileFrozenHolderRanking.mjs";
const incinerator="1nc1nerator11111111111111111111111111111";
test("frozen infrastructure exclusion mismatch is reported without mutation",()=>{
 const snapshot={id:"snap",mint:"mint",status:"frozen",holder_ranking:[{wallet:"A"},{wallet:"B"}],excluded_wallets:[incinerator]};
 const checkpoint={mint:"mint",holders:[{ownerWallet:"A"},{ownerWallet:incinerator}]};
 const before=JSON.stringify(checkpoint);
 const result=reconcileFrozenHolderRanking({snapshot,checkpoint});
 assert.equal(result.matchingWallets,1);
 assert.deepEqual(result.snapshotOnly,["B"]);
 assert.deepEqual(result.checkpointOnly,[incinerator]);
 assert.deepEqual(result.excludedCheckpointWallets,[incinerator]);
 assert.equal(result.safeToAttachSnapshot,false);
 assert.equal(result.checkpointModified,false);
 assert.equal(JSON.stringify(checkpoint),before);
});
test("identical frozen holder sets do not establish snapshot provenance",()=>{
 const snapshot={id:"snap",mint:"mint",status:"frozen",holder_ranking:[{wallet:"A"}],excluded_wallets:[]};
 const result=reconcileFrozenHolderRanking({snapshot,checkpoint:{mint:"mint",holders:[{ownerWallet:"A"}]}});
 assert.equal(result.safeToAttachSnapshot,false);
 assert.equal(result.walletSetMatches,true);
 assert.equal(result.snapshotProvenanceVerified,false);
 assert.equal(result.attachmentBlockReason,"SNAPSHOT_PROVENANCE_UNVERIFIED");
 assert.equal(result.scorePromoted,false);
});

for(const [name, mutate] of [
 ["missing provenance", checkpoint=>{delete checkpoint.snapshot;}],
 ["different slot", checkpoint=>{checkpoint.snapshot.slot=101;}],
 ["different raw supply", checkpoint=>{checkpoint.snapshot.supplyRaw="2000";}],
 ["different rank", checkpoint=>{checkpoint.holders.reverse();}],
 ["different raw balance", checkpoint=>{checkpoint.holders[0].amountRaw="101";}],
 ["different token account", checkpoint=>{checkpoint.holders[0].tokenAccount="other";}],
 ["different retained network identity", checkpoint=>{checkpoint.networkEvidence.snapshotIdentity="other";}],
 ["matching fixture fields without independent provenance", ()=>{}],
]) {
 test(`wallet membership does not authorize attachment: ${name}`,()=>{
  const snapshot={id:"snap",mint:"mint",status:"frozen",slot:100,supplyRaw:"1000",
   holder_ranking:[{wallet:"A",rank:1,tokenAccount:"accountA",amountRaw:"100"},{wallet:"B",rank:2,tokenAccount:"accountB",amountRaw:"50"}],excluded_wallets:[]};
  const checkpoint={mint:"mint",snapshot:{slot:100,supplyRaw:"1000"},
   holders:[{ownerWallet:"A",tokenAccount:"accountA",amountRaw:"100"},{ownerWallet:"B",tokenAccount:"accountB",amountRaw:"50"}],
   networkEvidence:{snapshotIdentity:"unverified fixture"}};
  mutate(checkpoint);
  const before=JSON.stringify({snapshot,checkpoint});
  const result=reconcileFrozenHolderRanking({snapshot,checkpoint});
  assert.equal(result.safeToAttachSnapshot,false);
  assert.equal(result.walletSetMatches,true);
  assert.equal(result.reconciliationRequired,false);
  assert.equal(result.snapshotProvenanceVerified,false);
  assert.equal(result.attachmentBlockReason,"SNAPSHOT_PROVENANCE_UNVERIFIED");
  assert.equal(result.checkpointModified,false);
  assert.equal(result.historyReset,false);
  assert.equal(result.scorePromoted,false);
  assert.equal(JSON.stringify({snapshot,checkpoint}),before);
 });
}
