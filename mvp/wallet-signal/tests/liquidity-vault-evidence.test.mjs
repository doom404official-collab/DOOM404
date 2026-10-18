import test from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import { inspectTokenVault } from "../lib/liquidityVaultEvidence.mjs";
const program=new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const mint=new PublicKey(Buffer.alloc(32,1)).toBase58();
function account({state=1,amount=123n,owner=program}={}){
 const data=Buffer.alloc(165);
 data.fill(1,0,32);
 data.fill(2,32,64);
 data.writeBigUInt64LE(amount,64);
 data.writeUInt8(state,108);
 return {owner,data};
}
test("accepts initialized classic SPL vault and returns raw amount",()=>{
 const result=inspectTokenVault(account(),mint);
 assert.equal(result.verified,true);
 assert.equal(result.rawAmount,"123");
 assert.equal(result.scope,"vault_token_account_only");
});
test("rejects wrong mint and non-initialized vault",()=>{
 assert.equal(inspectTokenVault(account(),"11111111111111111111111111111111").reason,"mint_mismatch");
 assert.equal(inspectTokenVault(account({state:0}),mint).reason,"token_account_not_initialized");
});
test("rejects missing account and malformed data",()=>{
 assert.equal(inspectTokenVault(null,mint).verified,false);
 assert.equal(inspectTokenVault({owner:program,data:Buffer.alloc(20)},mint).verified,false);
});
