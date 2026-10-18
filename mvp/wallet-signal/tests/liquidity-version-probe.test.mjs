import test from "node:test";
import assert from "node:assert/strict";
import {inspectVersionRejection} from "../lib/liquidityVersionProbe.mjs";
test("detects RPC version rejection without upgrading",()=>{
 const r=inspectVersionRejection({code:-32015,message:"unsupported transaction version"});
 assert.equal(r.versionRejection,true);
 assert.equal(r.automaticVersionUpgrade,false);
 assert.equal(r.versionHint,null);
});
test("extracts numeric version hint without acting on it",()=>{
 const r=inspectVersionRejection({code:-32015,message:"version: 1"});
 assert.equal(r.versionHint,1);
 assert.equal(r.automaticVersionUpgrade,false);
});
