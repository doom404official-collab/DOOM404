import {readFile,writeFile} from "node:fs/promises";
import {buildHolderConnectionGraph} from "../lib/holderConnectionGraph.mjs";
const input="artifacts/holder-history-checkpoint.json";
const cp=JSON.parse(await readFile(input,"utf8"));
if(cp.version!==1||!Array.isArray(cp.holders)||cp.holders.length!==20)throw Error("INVALID_CHECKPOINT");
const holders=cp.holders;
const walletSet=new Set(holders.map(h=>h.ownerWallet));
const txs=[];
let invalidEdges=0,unverifiedSignatures=0;
for(const edge of Object.values(cp.edges||{})){
 if(!walletSet.has(edge.walletA)||!walletSet.has(edge.walletB)||edge.walletA===edge.walletB){invalidEdges++;continue;}
 for(const signature of new Set(edge.signatures||[])){
  if(cp.signatures?.[signature]!=="checked"){unverifiedSignatures++;continue;}
  txs.push({confirmed:true,directInteraction:true,signature,participants:[edge.walletA,edge.walletB]});
 }
}
const graph=buildHolderConnectionGraph({holders,transactions:txs,historyComplete:false});
const result={mint:cp.mint,status:invalidEdges||unverifiedSignatures?"EVIDENCE_INCONSISTENCY":"CHECKPOINT_GRAPH_RECONSTRUCTED",
 holderAccounts:holders.length,distinctOwnerWallets:walletSet.size,
 observedTop20AccountSharePct:Number(holders.reduce((n,h)=>n+Number(h.sharePct),0).toFixed(4)),
 directPairs:graph.edges.length,connectedWallets:graph.connectedWalletCount,
 connectedGroups:graph.connectedGroups.map(g=>({wallets:g.members,combinedObservedSharePct:g.combinedObservedSharePct,
  directPairs:g.directEdges.length,signatures:g.directEdges.flatMap(e=>e.signatures)})),
 invalidEdges,unverifiedSignatures,independentTransactionReverification:false,
 providerHistoryExhausted:false,commonOwnershipEstablished:false,
 note:"Reconstructed from previously decoded checkpoint evidence. Each signature still requires independent transfer-level audit."};
await writeFile("artifacts/holder-connection-report.json",JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,connectedGroups:result.connectedGroups.map(g=>({...g,wallets:g.wallets.length,signatures:g.signatures.length}))}));
if(invalidEdges||unverifiedSignatures)process.exitCode=2;
