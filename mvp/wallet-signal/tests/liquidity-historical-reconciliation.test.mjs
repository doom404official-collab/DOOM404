import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {reconcileLiquidityHistory} from "../lib/liquidityHistoricalReconciliation.mjs";
const digest=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
test("reconciles bounded replay and pending recovery without completing history",()=>{
 const pool="pool",original={schemaVersion:1,pool,seen:["a","b","c","d"],pendingSignatures:["e","f"],events:[],classification:"AMOUNT_RECONCILED_AUTHORIZATION_PENDING",complete:false,updatedAt:"time",before:"cursor"};
 const replayDigest=digest({pool,seen:original.seen,events:original.events,updatedAt:original.updatedAt});
 const tx=signature=>({signature,execution:"EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED",candidates:[]});
 const replay=(signatures,unresolved=[])=>({kind:"HISTORICAL_DECODER_REPLAY_EVIDENCE",pool,sourceDigest:replayDigest,classification:original.classification,authorizationVerified:false,finalScore:null,transactions:signatures.map(tx),unresolved});
 const replays=[replay(["a"],[{signature:"b",reason:"REQUEST_BUDGET_EXHAUSTED"}]),replay(["b"]),replay(["c"]),replay(["d"])];
 const recovery={kind:"LIQUIDITY_PENDING_SIGNATURE_RECOVERY",pool,sourceDigest:digest(original),classification:original.classification,authorizationVerified:false,finalScore:null,transactions:[tx("e"),tx("f")],unresolved:[]};
 const result=reconcileLiquidityHistory(original,replays,recovery,pool);
 assert.equal(result.seen.length,6);assert.equal(result.pendingSignatures.length,0);
 assert.equal(result.complete,false);assert.equal(result.historyCoverageVerified,false);assert.equal(result.finalScore,null);
 assert.equal(original.pendingSignatures.length,2);
 assert.throws(()=>reconcileLiquidityHistory(original,[replays[0],replays[0],replays[2],replays[3]],recovery,pool),/DUPLICATE/);
 assert.throws(()=>reconcileLiquidityHistory(original,[replays[0],replay([]),replays[2],replays[3]],recovery,pool),/INCOMPLETE/);
});
