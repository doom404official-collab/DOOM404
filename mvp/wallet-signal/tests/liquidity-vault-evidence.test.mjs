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
 return {owner,data,executable:false};
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
 assert.equal(inspectTokenVault({owner:program,data:Buffer.alloc(20),executable:false},mint).verified,false);
});

test("supports Token-2022 base account layout with correct mint",()=>{
 const token2022=new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
 const result=inspectTokenVault(account({owner:token2022}),mint);
 assert.equal(result.verified,true);
 assert.equal(result.tokenProgram,token2022.toBase58());
 assert.equal(result.scope,"vault_token_account_only");
});

import {assessPumpAmmVaultAuthority} from "../lib/liquidityPoolAuthority.mjs";
import {comparePoolVaultSnapshots} from "../lib/liquidityHistoricalComparison.mjs";
for(const owner of [program,new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")]){
 for(const executable of [true,undefined,null,0,"false"]){
  test(`vault ${owner.toBase58()} rejects executable flag ${String(executable)} through comparison`,()=>{
   const raw=account({owner}),pool=new PublicKey(Buffer.alloc(32,2)).toBase58();
   const candidate={baseMint:mint,quoteMint:mint,poolBaseTokenAccount:new PublicKey(Buffer.alloc(32,3)).toBase58(),poolQuoteTokenAccount:new PublicKey(Buffer.alloc(32,4)).toBase58()};
   const row=v=>({pairAddress:pool,decodedPumpAmmCandidate:candidate,vaultAccountEvidence:{base:v,quote:v,authorityAssessment:assessPumpAmmVaultAuthority(pool,candidate,{base:v,quote:v})}});
   const good=row(inspectTokenVault(raw,mint));
   assert.equal(good.vaultAccountEvidence.authorityAssessment.authorityEvidenceComplete,true);
   assert.equal(comparePoolVaultSnapshots([good],[good]).comparedPools,1);
   raw.executable=executable;const bytes=Buffer.from(raw.data),bad=row(inspectTokenVault(raw,mint));
   assert.equal(bad.vaultAccountEvidence.base.verified,false);
   assert.equal(bad.vaultAccountEvidence.base.reason,'vault_executable_unverified');
   assert.equal(bad.vaultAccountEvidence.authorityAssessment.authorityEvidenceComplete,false);
   const comparison=comparePoolVaultSnapshots([good],[bad]);
   assert.equal(comparison.comparedPools,0);assert.equal(comparison.rejectedPools.length,1);
   assert.equal(comparison.liquidityStabilityVerified,false);assert.deepEqual(raw.data,bytes);
  });
 }
}
