import test from "node:test";
import assert from "node:assert/strict";
import {summarizeFrozenCrossJobNetwork} from "../lib/frozenCrossJobNetwork.mjs";
const wallet=n=>String(n).repeat(32);
const snapshot={id:"snap",mint:wallet(9),status:"frozen",supply_raw:"10000",excluded_wallets:[],holder_ranking:Array.from({length:20},(_,i)=>({wallet:wallet(String(i%8+1))+String(i).padStart(2,"0"),balance:"100"}))};
test("observed graph deduplicates transfers and never publishes final score",()=>{
 const s=structuredClone(snapshot);
 const tx={signature:"2".repeat(88),from:s.holder_ranking[0].wallet,to:s.holder_ranking[1].wallet,slot:1,assetType:"SOL",mint:null,amountRaw:"1",verifiedOnChain:true,transferVerified:true};
 const jobs=["a","b"].map(id=>({id,mint:s.mint,checkpoint:{networkEvidence:{transfers:[tx]}}}));
 const result=summarizeFrozenCrossJobNetwork({snapshot:s,jobs});
 assert.equal(result.uniqueTransferRecords,1);assert.equal(result.finalScore,null);
 assert.equal(result.scorePromoted,false);assert.equal(result.historyComplete,false);
});
