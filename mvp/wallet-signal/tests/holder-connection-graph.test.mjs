import test from "node:test";
import assert from "node:assert/strict";
import { buildHolderConnectionGraph } from "../lib/holderConnectionGraph.mjs";
const holders=[{ownerWallet:"A",sharePct:8},{ownerWallet:"B",sharePct:5},{ownerWallet:"C",sharePct:3}];
test("one confirmed direct transaction connects two holders",()=>{
 const r=buildHolderConnectionGraph({holders,transactions:[{confirmed:true,directInteraction:true,signature:"tx1",participants:["A","B"]}]});
 assert.equal(r.edges.length,1);
 assert.equal(r.connectedGroups[0].combinedObservedSharePct,13);
 assert.equal(r.commonOwnershipEstablished,false);
});
test("shared transaction without direct interaction does not establish connection",()=>{
 const r=buildHolderConnectionGraph({holders,transactions:[{confirmed:true,directInteraction:false,signature:"tx1",participants:["A","B"]}]});
 assert.equal(r.edges.length,0);
});
test("unconfirmed transactions do not count",()=>{
 const r=buildHolderConnectionGraph({holders,transactions:[{confirmed:false,directInteraction:true,signature:"tx1",participants:["A","B"]}]});
 assert.equal(r.edges.length,0);
});
test("indirect chains form connected groups but not ownership evidence",()=>{
 const r=buildHolderConnectionGraph({holders,transactions:[
 {confirmed:true,directInteraction:true,signature:"tx1",participants:["A","B"]},
 {confirmed:true,directInteraction:true,signature:"tx2",participants:["B","C"]}]});
 assert.equal(r.connectedGroups[0].members.length,3);
 assert.equal(r.edges.length,2);
 assert.equal(r.commonOwnershipEstablished,false);
});
