import test from "node:test";
import assert from "node:assert/strict";
import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
const mint="HSUMi4rMgjrx7zRUabw3ogGu1pa5hmF2eVcXj9Apump";
const creator="EQFgSvmavjfcvovYvgfETTcYvYzpHntqxkvDUViBTtZr";
const signature="23pzLeynMNuiPznPbqz15mXj1LwK1drnU4tCxUwUCVbSV1FXpUiibNfUojqcTonSKF5B6pQbb3runtjNe1MoAyNV";
test("vault evidence RPC write and readback",async()=>{
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  calls.push({url,opts});
  return {ok:true,json:async()=>url.includes("/rpc/")?"ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW":
   [{mint,signature,decoded_creator:creator}]};
 };
 const vault=createIntelligenceVault({url:"https://example.supabase.co",serviceRoleKey:"test-secret",fetchImpl});
 const result=await vault.storeCreatorEvidence({p_mint:mint,p_creator:creator,p_signature:signature,
  p_program_id:"6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",p_decoder_version:"test"});
 assert.equal(result,"ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW");
 assert.equal((await vault.getCreatorEvidence(mint))[0].decoded_creator,creator);
 assert.equal(calls.length,2);
});
test("vault rejects malformed evidence without network",async()=>{
 const vault=createIntelligenceVault({url:"https://example.supabase.co",serviceRoleKey:"test-secret",
  fetchImpl:()=>{throw Error("NETWORK_SHOULD_NOT_RUN");}});
 await assert.rejects(()=>vault.storeCreatorEvidence({p_mint:"bad"}),/INVALID_EVIDENCE_PAYLOAD/);
});
