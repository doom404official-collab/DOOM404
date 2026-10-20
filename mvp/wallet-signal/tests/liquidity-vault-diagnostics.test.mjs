import test from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import { inspectTokenVault } from "../lib/liquidityVaultEvidence.mjs";
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
test("missing vault is explicitly reported",()=>{
 assert.deepEqual(inspectTokenVault(null,mint),{verified:false,reason:"vault_account_missing"});
});
test("unsupported owner includes observed program for diagnosis",()=>{
 const owner=new PublicKey("11111111111111111111111111111111");
 const result=inspectTokenVault({owner,data:Buffer.alloc(165)},mint);
 assert.equal(result.verified,false);
 assert.equal(result.reason,"unsupported_token_account_program");
 assert.equal(result.observedOwnerProgram,owner.toBase58());
});
