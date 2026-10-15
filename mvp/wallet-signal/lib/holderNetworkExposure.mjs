// Supply-weighted metrics from discovered cross-asset holder relationships.
// This is an observed network, not proof of common ownership.
export function summarizeHolderNetworkExposure({holders,network,circulatingSupply}={}) {
 if(!Array.isArray(holders)||!network||!Array.isArray(network.clusters)||
   !Number.isFinite(circulatingSupply)||circulatingSupply<=0)
  throw new TypeError('Valid holders, network and positive supply required');
 const balances=new Map();
 for(const h of holders){
  if(!h||typeof h.wallet!=='string'||!Number.isFinite(h.balance)||h.balance<0||balances.has(h.wallet))
   throw new TypeError('Invalid or duplicate holder');
  balances.set(h.wallet,h.balance);
 }
 const pct=n=>Math.round(10000*n/circulatingSupply)/100;
 const seen=new Set();
 const clusters=network.clusters.map(c=>{
  const wallets=[...new Set(c.wallets??[])].filter(w=>balances.has(w));
  for(const w of wallets){if(seen.has(w))throw new TypeError('Overlapping network clusters');seen.add(w);}
  const balance=wallets.reduce((sum,w)=>sum+balances.get(w),0);
  return {walletCount:wallets.length,sharePct:pct(balance),creatorLinked:c.creatorLinked===true,wallets};
 }).sort((a,b)=>b.sharePct-a.sharePct);
 const connectedBalance=[...seen].reduce((sum,w)=>sum+balances.get(w),0);
 const creatorLinked=new Set(clusters.filter(c=>c.creatorLinked).flatMap(c=>c.wallets));
 const creatorLinkedBalance=[...creatorLinked].reduce((sum,w)=>sum+balances.get(w),0);
 return {connectedHolderCount:seen.size,connectedSupplyPct:pct(connectedBalance),
  creatorLinkedHolderCount:creatorLinked.size,creatorLinkedSupplyPct:pct(creatorLinkedBalance),
  largestClusterPct:clusters[0]?.sharePct??0,clusters,
  coverage:'Observed and verified transfers only; no discovered link does not prove independence'};
}
