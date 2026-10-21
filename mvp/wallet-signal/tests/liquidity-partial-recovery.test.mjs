import test from "node:test";
import assert from "node:assert/strict";
import {validateLiquidityPartialRecovery} from "../lib/liquidityPartialRecovery.mjs";
const prior={schemaVersion:1,pool:"pool",before:"cursor",seen:["a"],events:[],pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:"AMOUNT_RECONCILED_AUTHORIZATION_PENDING",requestCount:60,reconciliation:{sourceDigest:"origin"}};
test("partial recovery retains verified work and pending signature",()=>{
 const next={...prior,seen:["a","b"],pendingSignatures:["c"],requestCount:120};
 assert.equal(validateLiquidityPartialRecovery(prior,next,"pool").newlyCompleted,1);
 assert.throws(()=>validateLiquidityPartialRecovery(prior,{...next,before:"advanced"},"pool"),/CURSOR_ADVANCED/);
 assert.throws(()=>validateLiquidityPartialRecovery(prior,{...next,pendingSignatures:[]},"pool"),/PENDING_INVALID/);
 assert.throws(()=>validateLiquidityPartialRecovery(prior,{...next,finalScore:1},"pool"),/UNSAFE/);
});
