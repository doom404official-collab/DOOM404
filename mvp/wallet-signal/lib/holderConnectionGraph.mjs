/**
 * Evidence-only holder interaction graph. Edges indicate at least one confirmed
 * direct transaction interaction, NOT common ownership or collusion.
 * Transaction collection and top-30 ranking must be supplied by verified providers.
 */
export function buildHolderConnectionGraph({holders=[],transactions=[],historyComplete=false}={}){
 const unique=new Map();
 for(const h of holders.slice(0,30)){
  if(typeof h?.ownerWallet!=="string"||!Number.isFinite(Number(h.sharePct)))continue;
  const prior=unique.get(h.ownerWallet)||0;
  unique.set(h.ownerWallet,prior+Number(h.sharePct));
 }
 const wallets=[...unique.keys()];
 const eligible=new Set(wallets);
 const edges=new Map();
 for(const tx of transactions){
  if(tx?.confirmed!==true||typeof tx?.signature!=="string"||!Array.isArray(tx?.participants))continue;
  // Only explicit direct wallet-to-wallet interaction; shared fee payer, program
  // invocation or appearance in the same transaction is insufficient.
  if(tx.directInteraction!==true)continue;
  const pair=[...new Set(tx.participants.filter(x=>eligible.has(x)))];
  if(pair.length!==2)continue;
  pair.sort();
  const key=pair.join("|");
  if(!edges.has(key))edges.set(key,{walletA:pair[0],walletB:pair[1],signatures:[]});
  const edge=edges.get(key);
  if(!edge.signatures.includes(tx.signature))edge.signatures.push(tx.signature);
 }
 const parent=new Map(wallets.map(w=>[w,w]));
 function root(w){while(parent.get(w)!==w)w=parent.get(w);return w;}
 for(const edge of edges.values()){const a=root(edge.walletA),b=root(edge.walletB);if(a!==b)parent.set(b,a);}
 const groups=new Map();
 for(const w of wallets){const k=root(w);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(w);}
 const connectedGroups=[...groups.values()].filter(x=>x.length>1).map(members=>({
  members,combinedObservedSharePct:Number(members.reduce((n,w)=>n+unique.get(w),0).toFixed(4)),
  directEdges:[...edges.values()].filter(e=>members.includes(e.walletA)&&members.includes(e.walletB))
 })).sort((a,b)=>b.combinedObservedSharePct-a.combinedObservedSharePct);
 return {status:historyComplete?"observed_graph":"partial_history",
  holderWallets:wallets.length,edges:[...edges.values()],connectedGroups,
  connectedWalletCount:new Set(connectedGroups.flatMap(g=>g.members)).size,
  connectionCoverageComplete:historyComplete,
  commonOwnershipEstablished:false,
  warning:"One confirmed direct transaction establishes interaction only, not common control. Indirect graph paths do not establish ownership."};
}
