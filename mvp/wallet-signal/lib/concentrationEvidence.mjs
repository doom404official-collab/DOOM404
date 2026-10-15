// Convert independently verified wallet-transfer edges into disjoint connected components.
// Edges establish transactional relationships, not common ownership.
const valid = new Set(['strong', 'moderate']);
export function buildEvidenceClusters(edges = []) {
  if (!Array.isArray(edges)) throw new TypeError('edges must be an array');
  const parent = new Map();
  const accepted=[];
  function root(x) { if (!parent.has(x)) parent.set(x,x); if(parent.get(x)!==x) parent.set(x,root(parent.get(x))); return parent.get(x); }
  function union(a,b) { const ra=root(a),rb=root(b); if(ra!==rb) parent.set(rb,ra); }
  for(const e of edges) {
    if (!e || typeof e.from !== 'string' || !e.from || typeof e.to !== 'string' || !e.to || !valid.has(e.strength)) continue;
    if(e.from===e.to || e.verifiedTransfer!==true || !e.signature) continue;
    union(e.from,e.to);
    accepted.push(e);
  }
  const groups=new Map();
  for(const wallet of parent.keys()) {
    const key=root(wallet);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(wallet);
  }
  return [...groups.entries()].filter(([,wallets])=>wallets.length>1).map(([key,wallets])=>({
    wallets:wallets.sort(),
    strength:accepted.some(e=>e.strength==='moderate' && root(e.from)===key)?'moderate':'strong'
  }));
}
export function validateHolderSnapshot(snapshot) {
  if(!snapshot || !Number.isSafeInteger(snapshot.slot) || snapshot.slot<0 ||
    !Array.isArray(snapshot.holders) || !Number.isFinite(snapshot.circulatingSupply) ||
    snapshot.circulatingSupply<=0 || snapshot.complete!==true)
    return {valid:false,reason:'Holder snapshot incomplete or missing slot/supply'};
  const seen=new Set(); let total=0;
  for(const h of snapshot.holders) {
    if(!h || typeof h.wallet!=='string' || !h.wallet || seen.has(h.wallet) ||
      !Number.isFinite(h.balance) || h.balance<0)
      return {valid:false,reason:'Invalid or duplicate holder balance'};
    seen.add(h.wallet);total+=h.balance;
  }
  if(total>snapshot.circulatingSupply*(1+1e-9))
    return {valid:false,reason:'Holder balances exceed circulating supply'};
  if(snapshot.holders.length===0)
    return {valid:false,reason:'No holder balances'};
  return {valid:true,reason:null};
}
