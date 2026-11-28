import test from "node:test";
import assert from "node:assert/strict";
import {assessPumpAmmVaultAuthority} from "../lib/liquidityPoolAuthority.mjs";
const candidate={baseMint:"base",quoteMint:"quote"};
const evidence={base:{verified:true,mint:"base",authority:"pool"},quote:{verified:true,mint:"quote",authority:"pool"}};
test("matching pool vaults produce authority evidence but not LP safety",()=>{
 const result=assessPumpAmmVaultAuthority("pool",candidate,evidence);
 assert.equal(result.authorityEvidenceComplete,true);
 assert.equal(result.poolProgramAuthorityVerified,false);
 assert.equal(result.lpSecurityVerified,false);
});
test("mismatched authority fails closed",()=>{
 const result=assessPumpAmmVaultAuthority("pool",candidate,{...evidence,base:{...evidence.base,authority:"other"}});
 assert.equal(result.authorityEvidenceComplete,false);
});
test("missing vault fails closed",()=>{
 assert.equal(assessPumpAmmVaultAuthority("pool",candidate,{base:evidence.base}).authorityEvidenceComplete,false);
});
