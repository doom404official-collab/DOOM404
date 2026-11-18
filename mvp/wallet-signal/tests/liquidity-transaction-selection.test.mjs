import test from "node:test";
import assert from "node:assert/strict";
import {selectLiquidityTransactionSignatures} from "../lib/liquidityTransactionSelection.mjs";
test("skips failed and excluded signatures",()=>{
 const rows=[{signature:"a",err:null},{signature:"b",err:{failure:true}},{signature:"c",err:null}];
 const r=selectLiquidityTransactionSignatures(rows,{exclude:["a"]});
 assert.deepEqual(r.selected.map(x=>x.signature),["c"]);
 assert.equal(r.excludedCount,1);
});
test("caps selection at ten",()=>{
 const rows=Array.from({length:20},(_,i)=>({signature:String(i),err:null}));
 assert.equal(selectLiquidityTransactionSignatures(rows,{limit:20}).selected.length,10);
});
