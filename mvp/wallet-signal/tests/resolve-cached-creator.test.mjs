import test from "node:test";
import assert from "node:assert/strict";
import { resolveCachedCreator } from "../lib/resolveCachedCreator.mjs";
const mint="HSUMi4rMgjrx7zRUabw3ogGu1pa5hmF2eVcXj9Apump";
const creator="EQFgSvmavjfcvovYvgfETTcYvYzpHntqxkvDUViBTtZr";
const sig="23pzLeynMNuiPznPbqz15mXj1LwK1drnU4tCxUwUCVbSV1FXpUiibNfUojqcTonSKF5B6pQbb3runtjNe1MoAyNV";
const program="6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const version="pump-fun-create_v2-quote-control-v1";
const record={status:"ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW",verified_creator:creator,creation_signature:sig,program_id:program,decoder_version:version};
const evidence={mint,signature:sig,decoded_creator:creator,program_id:program,decoder_version:version,verification_status:"DECODED_MATCH"};
test("database-first lookup returns supported on-chain match",async()=>{
 const result=await resolveCachedCreator({mint,vault:{getAttribution:async()=>record,getCreatorEvidence:async()=>[evidence]}});
 assert.equal(result.creator,creator);
 assert.equal(result.source,"INTELLIGENCE_VAULT");
 assert.equal(result.independentlyReviewed,false);
});
test("conflicts and mismatched evidence are never verified",async()=>{
 const conflict=await resolveCachedCreator({mint,vault:{getAttribution:async()=>({...record,status:"CONFLICT"}),getCreatorEvidence:async()=>{throw Error("SHOULD_NOT_FETCH");}}});
 assert.equal(conflict.status,"CONFLICT");
 const bad=await resolveCachedCreator({mint,vault:{getAttribution:async()=>record,getCreatorEvidence:async()=>[{...evidence,decoded_creator:mint}]}});
 assert.equal(bad.status,"EVIDENCE_INCOMPLETE");
});
