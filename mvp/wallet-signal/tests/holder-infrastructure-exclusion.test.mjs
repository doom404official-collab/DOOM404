import test from "node:test";
import assert from "node:assert/strict";
import {buildHolderConnectionGraph} from "../lib/holderConnectionGraph.mjs";

const burn="1nc1nerator11111111111111111111111111111111";
const a="WalletA", b="WalletB";
const holders=[
 {ownerWallet:a,sharePct:5},
 {ownerWallet:burn,sharePct:12},
 {ownerWallet:b,sharePct:4}
];
const observation=(x,y,s)=>({confirmed:true,directInteraction:true,signature:s,participants:[x,y]});

test("incinerator is not an eligible holder or graph bridge",()=>{
 const graph=buildHolderConnectionGraph({holders,transactions:[
  observation(a,burn,"sig1"),observation(burn,b,"sig2")
 ]});
 assert.equal(graph.holderWallets,2);
 assert.equal(graph.edges.length,0);
 assert.equal(graph.connectedWalletCount,0);
 assert.equal(graph.connectedGroups.length,0);
});
test("eligible holder-to-holder transfer remains counted",()=>{
 const graph=buildHolderConnectionGraph({holders,transactions:[
  observation(a,b,"sig3"),observation(a,burn,"sig4")
 ]});
 assert.equal(graph.edges.length,1);
 assert.equal(graph.connectedWalletCount,2);
 assert.deepEqual(graph.edges[0].signatures,["sig3"]);
});
