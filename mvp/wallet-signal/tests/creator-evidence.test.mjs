import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../lib/creatorEvidence.js",import.meta.url),"utf8");
const {summarizeCreatorEvidence}=await import("data:text/javascript,"+encodeURIComponent(source));
test("no evidence never invents a creator",()=>{
 const result=summarizeCreatorEvidence({});
 assert.equal(result.status,"unverified");
 assert.equal(result.claims.length,0);
 assert.equal(result.creatorOwnershipVerified,false);
 assert.equal(result.launchPlatform.status,"not_verified");
});
test("provider creator and initialization signer remain distinct claims",()=>{
 const result=summarizeCreatorEvidence({
  creator:{status:"provider_attributed",address:"providerWallet",source:"solscan_pro",creationSignature:"signature"},
  mintOrigin:{status:"initialization_signer_observed",signers:["signerA","signerB","signerA"],signature:"tx",coverage:{initializationVerified:true}}
 });
 assert.equal(result.claims.length,3);
 assert.equal(result.claims[0].verification,"provider_reported");
 assert.equal(result.claims[1].verification,"onchain_observed");
 assert.equal(result.claims[2].address,"signerB");
 assert.equal(result.creatorOwnershipVerified,false);
});
test("unverified transaction is not labeled on-chain verified",()=>{
 const result=summarizeCreatorEvidence({mintOrigin:{status:"initialization_signer_observed",address:"signer",coverage:{}}});
 assert.equal(result.claims[0].verification,"unverified");
});
