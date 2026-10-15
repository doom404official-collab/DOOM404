// Cross-asset relationship discovery: any verified direct SOL/SPL transfer is a connection.
// Connection is NOT proof of common ownership or coordinated manipulation.
// Avoid false giant clusters through known exchanges, pools, and high-degree hubs.
export function analyzeHolderNetwork({holders,creatorWallets=[],transfers=[],infrastructureWallets=[],maxHubDegree=100}={}) {
 if(!Array.isArray(holders)||!Array.isArray(transfers)) throw new TypeError('holders and transfers must be arrays');
 const holderSet=new Set(holders.map(h=>h.wallet));
 const infra=new Set(infrastructureWallets);
 const creator=new Set(creatorWallets);
 const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 const signature=/^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
 const verified=transfers.filter(t=>t?.verifiedOnChain===true && t?.transferVerified===true &&
   address.test(t.from??'') && address.test(t.to??'') && t.from!==t.to && signature.test(t.signature??'') &&
   ['SOL','SPL','TOKEN_2022'].includes(t.assetType));
 const adjacency=new Map();
 const add=(a,b)=>{if(!adjacency.has(a))adjacency.set(a,new Set());adjacency.get(a).add(b);};
 for(const t of verified){add(t.from,t.to);add(t.to,t.from);}
 const hubs=new Set([...adjacency].filter(([,peers])=>peers.size>maxHubDegree).map(([wallet])=>wallet));
 const usable=verified.filter(t=>!infra.has(t.from)&&!infra.has(t.to)&&!hubs.has(t.from)&&!hubs.has(t.to));
 const graph=new Map();
 const connect=(a,b)=>{if(!graph.has(a))graph.set(a,new Set());graph.get(a).add(b);};
 for(const t of usable){connect(t.from,t.to);connect(t.to,t.from);}
 const visited=new Set(),clusters=[];
 for(const wallet of holderSet){
  if(visited.has(wallet))continue;
  const queue=[wallet],nodes=new Set(),members=new Set();
  visited.add(wallet);
  while(queue.length){
   const node=queue.pop();nodes.add(node);
   if(holderSet.has(node))members.add(node);
   for(const peer of graph.get(node)??[])if(!visited.has(peer)){visited.add(peer);queue.push(peer);}
  }
  if(members.size>1 || [...nodes].some(n=>creator.has(n)))
   clusters.push({wallets:[...members].sort(),creatorLinked:[...nodes].some(n=>creator.has(n)),networkNodeCount:nodes.size});
 }
 const connected=new Set(clusters.flatMap(c=>c.wallets));
 const directlyConnected=new Set();
 for(const t of usable)if(holderSet.has(t.from)&&holderSet.has(t.to)){
  directlyConnected.add(t.from);directlyConnected.add(t.to);
 }
 return {clusters,connectedHolderCount:connected.size,directHolderCount:directlyConnected.size,
  noDiscoveredConnectionCount:holderSet.size-connected.size,
  verifiedTransferCount:verified.length,usableTransferCount:usable.length,
  excludedInfrastructureCount:infra.size,excludedHighDegreeHubCount:hubs.size,
  coverage:'observed verified transactions only',
  note:'A transfer establishes an on-chain relationship, not common ownership or manipulation.'};
}
