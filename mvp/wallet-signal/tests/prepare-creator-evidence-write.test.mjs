import test from "node:test";
import assert from "node:assert/strict";
import { prepareCreatorEvidenceWrite } from "../lib/prepareCreatorEvidenceWrite.mjs";
const mint="HSUMi4rMgjrx7zRUabw3ogGu1pa5hmF2eVcXj9Apump";
const creator="EQFgSvmavjfcvovYvgfETTcYvYzpHntqxkvDUViBTtZr";
const sig="23pzLeynMNuiPznPbqz15mXj1LwK1drnU4tCxUwUCVbSV1FXpUiibNfUojqcTonSKF5B6pQbb3runtjNe1MoAyNV";
const program="6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const proof={status:"VERIFIED",decodedRoles:[{role:"launchpad_creator",verifiedInstruction:true,
 mint,signature:sig,address:creator,programId:program,decoderVersion:"pump-fun-create_v2-quote-control-v1"}]};
test("prepare evidence only for a matching verified creator",()=>{
 const x=prepareCreatorEvidenceWrite({mint,indexedCreator:creator,creationSignature:sig,proof});
 assert.equal(x?.p_creator,creator);
 assert.equal(x?.p_fee_payer,null);
});
test("reject indexed mismatch, missing proof and ambiguous roles",()=>{
 assert.equal(prepareCreatorEvidenceWrite({mint,indexedCreator:mint,creationSignature:sig,proof}),null);
 assert.equal(prepareCreatorEvidenceWrite({mint,indexedCreator:creator,creationSignature:sig,proof:{status:"UNRESOLVED"}}),null);
 assert.equal(prepareCreatorEvidenceWrite({mint,indexedCreator:creator,creationSignature:sig,
  proof:{...proof,decodedRoles:[...proof.decodedRoles,...proof.decodedRoles]}}),null);
});
