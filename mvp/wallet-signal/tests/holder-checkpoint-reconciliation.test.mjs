import test from "node:test";
import assert from "node:assert/strict";
import {planHolderCheckpointReconciliation} from "../lib/holderCheckpointReconciliation.mjs";
const burn="1nc1nerator11111111111111111111111111111111";
test("plans 19 reusable wallets and one missing eligible wallet without mutation",()=>{
 const checkpoint={holders:[...Array.from({length:19},(_,i)=>({ownerWallet:"wallet"+i})),{ownerWallet:burn}],wallets:{},signatures:{sig:"checked"}};
 const before=JSON.stringify(checkpoint);
 const eligible=[...Array.from({length:19},(_,i)=>({wallet:"wallet"+i})),{wallet:"replacement"}];
 const result=planHolderCheckpointReconciliation({checkpoint,eligibleHolders:eligible});
 assert.equal(result.reusableWallets.length,19);
 assert.deepEqual(result.missingWallets,["replacement"]);
 assert.deepEqual(result.excludedFromTarget,[burn]);
 assert.equal(result.signatureStateTransferSafe,false);
 assert.equal(JSON.stringify(checkpoint),before);
});
test("rejects infrastructure wallet in eligible set",()=>{
 assert.throws(()=>planHolderCheckpointReconciliation({
  checkpoint:{holders:[],wallets:{}},
  eligibleHolders:[...Array.from({length:19},(_,i)=>"wallet"+i),burn]
 }),/INVALID_ELIGIBLE_HOLDER_SET/);
});
