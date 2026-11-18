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
 const result=inspectLpMintAccount({owner:tokenProgram,data,executable:false},"lp",1000n);
 assert.equal(result.mintAccountVerified,true);
 assert.equal(result.supplyMatchesPool,null);
 assert.equal(result.supplyComparisonStatus,"not_directly_comparable");
 assert.equal(result.lpBurnVerified,false);
 assert.equal(result.lpLockVerified,false);
 assert.equal(result.withdrawalRightsVerified,false);
});
test("missing LP mint fails closed",()=>{
 assert.equal(inspectLpMintAccount(null,"lp",100).mintAccountVerified,false);
});

import {assessPumpAmmWithdrawalRights} from "../lib/pumpAmmWithdrawalEvidence.mjs";
const mintAddress=new PublicKey(Buffer.alloc(32,7)).toBase58();
const token2022=new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
function binaryMint(length=82,owner=token2022){
 const data=Buffer.alloc(length);data.writeBigUInt64LE(1000n,36);data[44]=6;data[45]=1;
 if(length>=166)data[165]=1;
 return {owner,data,executable:false};
}
for(const length of [83,165,166,355])test(`classic LP mint rejects non-mint length ${length}`,()=>{
 const result=inspectLpMintAccount(binaryMint(length,tokenProgram),mintAddress,'1000');
 assert.equal(result.mintAccountVerified,false);assert.equal(result.reason,'invalid_lp_mint_layout');
 assert.equal(assessPumpAmmWithdrawalRights({lpMintEvidence:result}).lpMintValidated,false);
});
test('valid Token-2022 base and supported metadata-pointer extension preserve mint-only output',()=>{
 for(const length of [82,234]){
  const account=binaryMint(length);
  if(length>82){account.data.writeUInt16LE(18,166);account.data.writeUInt16LE(64,168);}
  const before=Buffer.from(account.data),r=inspectLpMintAccount(account,mintAddress,'2000');
  assert.equal(r.mintAccountVerified,true);assert.equal(r.rawSupply,'1000');assert.equal(r.lpMint,mintAddress);
  assert.equal(r.mintAuthority,null);assert.equal(r.freezeAuthority,null);assert.equal(r.supplyMatchesPool,null);
  assert.equal(r.lpBurnVerified,false);assert.equal(r.lpLockVerified,false);assert.equal(r.withdrawalRightsVerified,false);
  assert.deepEqual(account.data,before);
 }
});
for(const [name,mutate] of [
 ['token-account discriminator',a=>{a.data[165]=2;}],
 ['nonzero mint padding',a=>{a.data[82]=1;}],
 ['truncated extension value',a=>{a.data.writeUInt16LE(18,166);a.data.writeUInt16LE(65,168);}],
 ['unsupported extension',a=>{a.data.writeUInt16LE(999,166);}],
 ['executable account',a=>{a.executable=true;}],
 ['uninitialized mint',a=>{a.data[45]=0;}],
 ['invalid authority option',a=>{a.data.writeUInt32LE(2,0);}]
])test(`Token-2022 LP mint withholds malformed evidence: ${name}`,()=>{
 const a=binaryMint(234);a.data.writeUInt16LE(18,166);a.data.writeUInt16LE(64,168);mutate(a);
 const before=Buffer.from(a.data),r=inspectLpMintAccount(a,mintAddress,'1000');
 assert.equal(r.mintAccountVerified,false);assert.equal(r.withdrawalRightsVerified,false);
 assert.equal(assessPumpAmmWithdrawalRights({lpMintEvidence:r}).lpMintValidated,false);
 assert.deepEqual(a.data,before);
});
test('Token-2022 LP mint refuses invalid expected identity',()=>{
 assert.equal(inspectLpMintAccount(binaryMint(), 'lp', '1000').mintAccountVerified,false);
});

for(const executable of [true,undefined,null,0,'false'])test(`classic LP mint rejects nonliteral executable flag ${String(executable)}`,()=>{
 const account=binaryMint(82,tokenProgram);account.executable=executable;
 const r=inspectLpMintAccount(account,mintAddress,'1000');
 assert.equal(r.mintAccountVerified,false);assert.equal(r.reason,'lp_mint_executable_unverified');
 assert.equal(assessPumpAmmWithdrawalRights({lpMintEvidence:r}).lpMintValidated,false);
});
