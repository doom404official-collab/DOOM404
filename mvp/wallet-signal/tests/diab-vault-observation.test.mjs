import test from "node:test";
import assert from "node:assert/strict";
import {observeDiabVaults} from "../lib/diabVaultObservation.mjs";
test("observes vault balance metadata without promoting history or score",()=>{
 const tx={slot:458818672,transaction:{message:{accountKeys:[{pubkey:"pool",writable:true,signer:false},{pubkey:"vault",writable:true,signer:false}]}},meta:{err:null,innerInstructions:[],preTokenBalances:[{accountIndex:1,mint:"WSOL",owner:"pool",uiTokenAmount:{amount:"12"}}],postTokenBalances:[{accountIndex:1,mint:"WSOL",owner:"pool",uiTokenAmount:{amount:"10"}}]}};
 const r=observeDiabVaults(tx,{pool:"pool",vaults:["vault","other"]});
 assert.equal(r.balances.length,2);
 assert.equal(r.innerInstructionCount,0);
 assert.equal(r.historicalStateVerified,false);
 assert.equal(r.scorePromoted,false);
});
test("missing CPI metadata is distinct from an empty array",()=>{
 const tx={slot:1,transaction:{message:{accountKeys:[]}},meta:{err:null,innerInstructions:null}};
 assert.equal(observeDiabVaults(tx,{pool:"pool",vaults:["a","b"]}).innerMetadataState,"null");
});
