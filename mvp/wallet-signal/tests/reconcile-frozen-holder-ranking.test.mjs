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
test("identical frozen holder sets permit identity reconciliation only",()=>{
 const snapshot={id:"snap",mint:"mint",status:"frozen",holder_ranking:[{wallet:"A"}],excluded_wallets:[]};
 const result=reconcileFrozenHolderRanking({snapshot,checkpoint:{mint:"mint",holders:[{ownerWallet:"A"}]}});
 assert.equal(result.safeToAttachSnapshot,true);
 assert.equal(result.scorePromoted,false);
});
