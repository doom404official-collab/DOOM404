import test from "node:test";
import assert from "node:assert/strict";
import {prepareExternalNetworkMerge} from "../lib/prepareExternalNetworkMerge.mjs";
const wallet="2".repeat(32),peer="3".repeat(32),sig="4".repeat(88);
const cp=()=>{const c={mint:wallet,snapshot:{supplyRaw:"100"},holders:[{ownerWallet:wallet,tokenAccount:peer,amountRaw:"10",sharePct:10}],signatures:{[sig]:"checked"}};c.networkEvidence={version:1,snapshotIdentity:JSON.stringify({mint:c.mint,snapshot:c.snapshot,holders:c.holders}),processed:{},transfers:[],retentionLimited:false};return c;};
const row=()=>({signature:sig,evidence:{networkExtraction:{version:1,valid:true,unresolvedTokenTransfers:0,transfers:[{signature:sig,slot:1,from:wallet,to:peer,assetType:"SOL",mint:null,amountRaw:"1",verifiedOnChain:true,transferVerified:true}]}}});
test("merge preparation is immutable and requires atomic commit",()=>{const original=cp(),before=JSON.stringify(original);const result=prepareExternalNetworkMerge({checkpoint:original,evidenceRows:[row()]});assert.equal(result.addedTransfers,1);assert.equal(result.requiresAtomicCommit,true);assert.equal(JSON.stringify(original),before);assert.equal(result.checkpoint.networkEvidence.processed[sig].transferCount,1);});
test("duplicate already processed signature cannot be appended twice",()=>{const original=cp();const once=prepareExternalNetworkMerge({checkpoint:original,evidenceRows:[row()]});const twice=prepareExternalNetworkMerge({checkpoint:once.checkpoint,evidenceRows:[row()]});assert.equal(twice.addedTransfers,0);assert.equal(twice.requiresAtomicCommit,false);});
test("snapshot mismatch fails closed",()=>{const original=cp();original.snapshot.supplyRaw="101";assert.throws(()=>prepareExternalNetworkMerge({checkpoint:original,evidenceRows:[row()]}),/SNAPSHOT/);});
