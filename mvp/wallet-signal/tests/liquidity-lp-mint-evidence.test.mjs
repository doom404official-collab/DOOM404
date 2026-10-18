import test from "node:test";
import assert from "node:assert/strict";
import {PublicKey} from "@solana/web3.js";
import {inspectLpMintAccount} from "../lib/liquidityLpMintEvidence.mjs";
const tokenProgram=new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
test("valid LP mint supply comparison does not claim locks or burns",()=>{
 const data=Buffer.alloc(82);
 data.writeUInt32LE(0,0);
 data.writeBigUInt64LE(1000n,36);
 data[44]=6;
 data[45]=1;
 data.writeUInt32LE(0,46);
 const result=inspectLpMintAccount({owner:tokenProgram,data},"lp",1000n);
 assert.equal(result.mintAccountVerified,true);
 assert.equal(result.supplyMatchesPool,true);
 assert.equal(result.lpBurnVerified,false);
 assert.equal(result.lpLockVerified,false);
 assert.equal(result.withdrawalRightsVerified,false);
});
test("missing LP mint fails closed",()=>{
 assert.equal(inspectLpMintAccount(null,"lp",100).mintAccountVerified,false);
});
