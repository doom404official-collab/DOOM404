import {buildHolderConnectionGraph} from "./holderConnectionGraph.mjs";
import {summarizeHistoryCheckpoint} from "./holderHistoryCheckpoint.mjs";
/** Public, credential-free projection of a private checkpoint. */
export function publicHolderScanView(checkpoint,{updatedAt=null}={}){
 if(!checkpoint||!Array.isArray(checkpoint.holders)||!checkpoint.wallets)throw Error("INVALID_CHECKPOINT");
 const observations=[];
 for(const edge of Object.values(checkpoint.edges||{})){
  if(!edge||typeof edge.walletA!=="string"||typeof edge.walletB!=="string")continue;
  for(const signature of edge.signatures||[]){
   if(checkpoint.signatures?.[signature]!=="checked")continue;
   observations.push({signature,confirmed:true,directInteraction:true,participants:[edge.walletA,edge.walletB]});
  }
 }
 const graph=buildHolderConnectionGraph({holders:checkpoint.holders,transactions:observations,historyComplete:false});
 const stats=summarizeHistoryCheckpoint(checkpoint);
 const wallets=[...new Set(checkpoint.holders.map(h=>h.ownerWallet))];
 const holdings=checkpoint.holders.reduce((sum,h)=>sum+Number(h.sharePct||0),0);
 return {mint:checkpoint.mint,updatedAt,top20SharePct:Number(holdings.toFixed(4)),
  holders:checkpoint.holders.map(h=>({tokenAccount:h.tokenAccount,ownerWallet:h.ownerWallet,sharePct:h.sharePct})),
  ownerWalletsResolved:wallets.length,connectedWallets:graph.connectedWalletCount,
  directPairs:graph.edges.length,connectedGroups:graph.connectedGroups,
  transactionsChecked:stats.transactionsChecked,transactionsPending:stats.transactionsPending,
  walletHistoriesReached:Object.values(checkpoint.wallets).filter(w=>w.pages>0).length,
  walletHistoriesExhausted:stats.walletsProviderExhausted,
  historyComplete:stats.providerHistoryExhausted,
  commonOwnershipEstablished:false};
}
