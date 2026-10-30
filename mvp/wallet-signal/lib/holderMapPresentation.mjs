// Display model only: never establishes history, ownership, eligibility or score.
const signature=s=>typeof s==='string'&&/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(s);
export function buildHolderMapPresentation(holders=[],groups=[],verifiedPairs=[]){
 holders=Array.isArray(holders)?holders:[];groups=Array.isArray(groups)?groups:[];verifiedPairs=Array.isArray(verifiedPairs)?verifiedPairs:[];
 const address=value=>typeof value==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
 const unique=new Map(),accounts=new Map();
 for(const h of holders){
  if(typeof h?.ownerWallet!=='string'||!h.ownerWallet)continue;
  if(!unique.has(h.ownerWallet))unique.set(h.ownerWallet,{wallet:h.ownerWallet,sharePct:0,rank:unique.size+1,unknown:false});
  const owner=unique.get(h.ownerWallet);
  if(!address(h.ownerWallet)||!address(h.tokenAccount)){owner.unknown=true;continue;}
  const share=typeof h.sharePct==='number'&&Number.isFinite(h.sharePct)&&h.sharePct>=0&&h.sharePct<=100?h.sharePct:null;
  const rawValid=h.amountRaw===undefined||typeof h.amountRaw==='string'&&/^\d+$/.test(h.amountRaw);
  const prior=accounts.get(h.tokenAccount);
  if(prior){
   if(prior.owner!==h.ownerWallet||prior.share!==share||prior.amountRaw!==h.amountRaw||!rawValid){
    prior.conflict=true;unique.get(prior.owner).unknown=true;owner.unknown=true;
   }
  }else accounts.set(h.tokenAccount,{owner:h.ownerWallet,share,amountRaw:h.amountRaw,conflict:!rawValid});
 }
 for(const account of accounts.values()){
  const owner=unique.get(account.owner);
  if(account.conflict||account.share===null)owner.unknown=true;
  else owner.sharePct+=account.share;
 }
 for(const owner of unique.values()){
  if(owner.unknown||owner.sharePct>100)owner.sharePct=null;
  delete owner.unknown;
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
