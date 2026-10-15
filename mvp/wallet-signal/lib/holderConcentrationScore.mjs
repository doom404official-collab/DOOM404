// Holder concentration scoring v1 — deterministic, evidence-aware, no external calls.
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const round = (n) => Math.round(n * 100) / 100;
function component(value, low, high, weight) {
  return round(weight * (1 - clamp((value - low) / (high - low))));
}
export function scoreHolderConcentration(input) {
  const { holders, circulatingSupply, connectedClusters = [], creatorTeamWallets = [],
    excludedWallets = [], investigationComplete = false } = input ?? {};
  if (!Array.isArray(holders) || !finite(circulatingSupply) || circulatingSupply <= 0)
    throw new TypeError('holders array and positive circulatingSupply required');
  const excluded = new Set(excludedWallets);
  const balances = new Map();
  for (const h of holders) {
    if (!h || typeof h.wallet !== 'string' || !h.wallet || !finite(h.balance) || h.balance < 0)
      throw new TypeError('Invalid holder entry');
    if (balances.has(h.wallet)) throw new TypeError('Duplicate holder wallet');
    balances.set(h.wallet, h.balance);
  }
  const eligible = [...balances].filter(([wallet]) => !excluded.has(wallet))
    .sort((a,b) => b[1]-a[1]);
  const share = (amount) => 100 * amount / circulatingSupply;
  const top10Pct = share(eligible.slice(0,10).reduce((s,[,v])=>s+v,0));
  const uniqueEligible = eligible.filter(([,v])=>v>0).length;
  const teamPct = share([...new Set(creatorTeamWallets)].reduce((s,w)=>s+(excluded.has(w)?0:(balances.get(w)??0)),0));
  let maxClusterPct = 0;
  const seen = new Set();
  for (const cluster of connectedClusters) {
    if (!Array.isArray(cluster.wallets) || !['strong','moderate','weak','unverified'].includes(cluster.strength))
      throw new TypeError('Invalid connected cluster');
    if (!['strong','moderate'].includes(cluster.strength)) continue;
    const members = [...new Set(cluster.wallets)].filter(w=>!excluded.has(w) && balances.has(w));
    for (const w of members) {
      if (seen.has(w)) throw new TypeError('Overlapping clusters must be merged first');
      seen.add(w);
    }
    maxClusterPct = Math.max(maxClusterPct, share(members.reduce((s,w)=>s+balances.get(w),0)));
  }
  const components = {
    topHolders: component(top10Pct, 10, 70, 35),
    connectedWallets: investigationComplete ? component(maxClusterPct, 2, 35, 35) : null,
    creatorTeam: component(teamPct, 1, 25, 20),
    breadth: round(10 - component(uniqueEligible, 20, 1000, 10))
  };
  // Breadth rewards a larger distinct-holder population.
  const known = components.topHolders + components.creatorTeam + components.breadth;
  const score = investigationComplete ? round(known + components.connectedWallets) : null;
  return {
    status: investigationComplete ? 'final' : 'provisional',
    score,
    provisionalRange: investigationComplete ? null : [round(known), round(known + 35)],
    components,
    metrics: { top10Pct: round(top10Pct), maxVerifiedClusterPct: investigationComplete ? round(maxClusterPct) : null,
      creatorTeamPct: round(teamPct), eligibleHolderCount: uniqueEligible },
    caveats: ['Transfer relationships do not prove common ownership or manipulation.',
      'Excluded wallets must be independently verified as infrastructure.',
      'Input balances must represent a consistent supply snapshot.']
  };
}
