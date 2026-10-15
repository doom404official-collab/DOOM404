// Extract cross-asset SPL/Token-2022 transfers from an independently fetched parsed transaction.
// Owner resolution is required: token-account addresses alone are not wallet identities.
const validAddress=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const validSignature=/^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
export function extractCrossAssetTokenTransfers(tx,{signature,wallet}={}) {
 if(!validSignature.test(signature??''))throw new TypeError('Valid transaction signature required');
 if(!tx || tx.meta?.err!==null)return [];
 const keys=tx.transaction?.message?.accountKeys??[];
 const keyAt=i=>{const k=keys[i];return typeof k==='string'?k:k?.pubkey?.toBase58?.()??k?.pubkey??null;};
 const ownership=new Map();
 const mints=new Map();
 for(const b of [...(tx.meta?.preTokenBalances??[]),...(tx.meta?.postTokenBalances??[])]){
  const account=keyAt(b.accountIndex);
  if(typeof account==='string' && validAddress.test(b.owner??'') && validAddress.test(b.mint??'')){
   ownership.set(account,b.owner);mints.set(account,b.mint);
  }
 }
 const instructions=[...(tx.transaction?.message?.instructions??[]),
  ...(tx.meta?.innerInstructions??[]).flatMap(g=>g.instructions??[])];
 const edges=[];
 for(const ix of instructions){
  if(!['spl-token','spl-token-2022'].includes(ix.program))continue;
  if(!['transfer','transferChecked'].includes(ix.parsed?.type))continue;
  const info=ix.parsed.info??{};
  const from=ownership.get(info.source),to=ownership.get(info.destination);
  const mint=info.mint??mints.get(info.source)??mints.get(info.destination);
  if(!validAddress.test(from??'')||!validAddress.test(to??'')||!validAddress.test(mint??'')||from===to)continue;
  if(wallet && from!==wallet && to!==wallet)continue;
  if(mints.has(info.source)&&mints.get(info.source)!==mint)continue;
  if(mints.has(info.destination)&&mints.get(info.destination)!==mint)continue;
  edges.push({from,to,signature,assetType:ix.program==='spl-token-2022'?'TOKEN_2022':'SPL',
   mint,verifiedOnChain:true,transferVerified:true,slot:tx.slot});
 }
 return edges;
}
