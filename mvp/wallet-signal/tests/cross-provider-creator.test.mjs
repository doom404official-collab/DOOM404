import test from "node:test";
import assert from "node:assert/strict";
import { corroborateCreatorAcrossProviders } from "../lib/crossProviderCreator.mjs";
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const creator="6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC";
const sig="KMoj9pQq8XncaZPHQ5bTNZPDgQwfCBgdihVkxc5Y27fh7iGYwMbti2Mcscprhia1NBJauBbEvs5DE8ooWKWg6bs";
function solscan(creatorLabel,createTx){
 return async()=>({ok:true,json:async()=>({success:true,data:{address:mint,creator:creatorLabel,create_tx:createTx}})});
}
const base={mint,heliusCreator:creator,heliusSignature:sig,solscanApiKey:"test-key"};
test("matching Solscan metadata is only provider corroboration",async()=>{
 const r=await corroborateCreatorAcrossProviders({...base,solscanFetch:solscan(creator,sig)});
 assert.equal(r.status,"PROVIDER_LABELS_AGREE_TRANSACTION_NOT_INDEPENDENTLY_DECODED");
 assert.equal(r.independentlyDecoded,false);
});
test("creator mismatch is reported without promotion",async()=>{
 const r=await corroborateCreatorAcrossProviders({...base,solscanFetch:solscan(mint,sig)});
 assert.equal(r.status,"PROVIDER_DISAGREEMENT");
 assert.equal(r.creatorMatches,false);
});
test("transaction mismatch is reported without promotion",async()=>{
 const r=await corroborateCreatorAcrossProviders({...base,solscanFetch:solscan(creator,"aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7")});
 assert.equal(r.status,"PROVIDER_DISAGREEMENT");
 assert.equal(r.signatureMatches,false);
});
test("Helius cannot masquerade as independent archive",async()=>{
 const r=await corroborateCreatorAcrossProviders({...base,solscanFetch:solscan(creator,sig),archiveRpcUrl:"https://mainnet.helius-rpc.com/?api-key=test"});
 assert.equal(r.status,"INDEPENDENT_ARCHIVE_REQUIRED");
});
test("missing Solscan key yields an explicit incomplete status",async()=>{
 const r=await corroborateCreatorAcrossProviders({...base,solscanApiKey:null});
 assert.equal(r.status,"SOLSCAN_NOT_CONFIGURED");
});
