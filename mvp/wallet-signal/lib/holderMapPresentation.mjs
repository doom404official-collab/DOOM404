// Display model only: never establishes history, ownership, eligibility or score.
const signature=s=>typeof s==='string'&&/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(s);
export function buildHolderMapPresentation(holders=[],groups=[],verifiedPairs=[]){
 holders=Array.isArray(holders)?holders:[];groups=Array.isArray(groups)?groups:[];verifiedPairs=Array.isArray(verifiedPairs)?verifiedPairs:[];
 const unique=new Map();
 for(const h of holders){
  if(typeof h?.ownerWallet!=='string'||!h.ownerWallet)continue;
  const share=typeof h.sharePct==='number'&&Number.isFinite(h.sharePct)&&h.sharePct>=0&&h.sharePct<=100?h.sharePct:null;
  const old=unique.get(h.ownerWallet);
  if(old)old.sharePct=old.sharePct===null||share===null?null:old.sharePct+share;
  else unique.set(h.ownerWallet,{wallet:h.ownerWallet,sharePct:share,rank:unique.size+1});
 }
 const nodes=[...unique.values()],edges=new Map();
 for(const g of groups)for(const e of Array.isArray(g?.directEdges)?g.directEdges:[]){
  if(!unique.has(e?.walletA)||!unique.has(e?.walletB)||e.walletA===e.walletB)continue;
  const [a,b]=[e.walletA,e.walletB].sort(),key=a+'|'+b;
  if(!edges.has(key))edges.set(key,{key,walletA:a,walletB:b,signatures:new Set(),verifiedSignatures:new Set()});
  for(const s of Array.isArray(e.signatures)?e.signatures:[])if(signature(s))edges.get(key).signatures.add(s);
 }
 for(const pair of verifiedPairs){
  const key=[pair?.walletA,pair?.walletB].sort().join('|'),edge=edges.get(key);if(!edge)continue;
  for(const s of Array.isArray(pair.signatures)?pair.signatures:[])if(edge.signatures.has(s))edge.verifiedSignatures.add(s);
 }
 return {nodes,edges:[...edges.values()].map(e=>({...e,signatures:[...e.signatures],verifiedSignatures:[...e.verifiedSignatures]}))};
}
