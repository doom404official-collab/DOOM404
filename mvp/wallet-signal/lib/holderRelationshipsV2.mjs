import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
const MINT='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',HASH='77f749040d291e057c546d1f4872f4de9432bdda4be512a0dc94bda14bc20daa';
export function projectHolderRelationshipsV2(row,mint){
 try{
  const c=row?.checkpoint;
  if(!row||row.mint!==mint||mint!==MINT||row.holder_set_hash!==HASH||c?.snapshot?.holderSetHash!==HASH||c.snapshot.id!=='0596510d6dc07e1dce934fba0dcf96a5594b38807383bd6d829d9d6fe441177b'||c.snapshot.slot!==474029636||c.holders?.length!==20||!Array.isArray(c.networkEvidence?.transfers))return null;
  const wallets=new Map(c.holders.map(h=>[h.ownerWallet,BigInt(h.amountRaw)]));if(wallets.size!==20||createHash('sha256').update(JSON.stringify(c.holders.map(h=>[h.ownerWallet,h.amountRaw]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0))).digest('hex')!=='ed8a282ebcdc77c9cb226cc776b4dea05e3d60df5f34e8723278177d39c179bc')return null;
  const supply=BigInt(c.snapshot.supplyRaw),seen=new Set(),edges=[],members=new Set();
  for(const t of c.networkEvidence.transfers){
   const checked=c.networkEvidence.processed?.[t.signature];if(checked?.valid!==true||checked.extractorRevision!=='HOLDER_TRANSFER_CONTEXT_V2_2026_11_18'||!Number.isSafeInteger(t.outerInstructionIndex)||t.outerInstructionIndex<0||!['11111111111111111111111111111111','TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(t.programId)||t.assetType==='SOL'&&t.innerInstructionIndex!==null)continue;
   if(t.verifiedOnChain!==true||t.transferVerified!==true||!wallets.has(t.from)||!wallets.has(t.to)||t.from===t.to||!Number.isSafeInteger(t.slot)||t.slot<0||!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(t.signature||''))continue;
   new PublicKey(t.from);new PublicKey(t.to);
   if(!/^[0-9]+$/.test(t.amountRaw||''))continue;
   const amount=BigInt(t.amountRaw),material=t.assetType==='SOL'?amount>=50000000n:t.mint===mint&&amount*10000n>=supply;
   if(!material)continue;
   const id=t.signature+':'+t.outerInstructionIndex+':'+String(t.innerInstructionIndex??'outer');if(seen.has(id))continue;seen.add(id);members.add(t.from);members.add(t.to);
   edges.push({signature:t.signature,slot:t.slot,from:t.from,to:t.to,assetType:t.assetType,amountRaw:t.amountRaw,relation:'observed_material_transfer',commonOwnershipEstablished:false});
  }
  const exposure=[...members].reduce((n,w)=>n+wallets.get(w),0n);
  return {version:2,mint,holderSetHash:HASH,snapshotSlot:474029636,connectedExposurePct:Number(exposure*1000000n/supply)/10000,relationships:edges,relationshipCount:new Set(edges.map(e=>[e.from,e.to].sort().join('|'))).size,connectedWalletCount:members.size,historyComplete:false,coverageScope:'Retained individually verified transactions, not an exhaustive historical window.',excluded:['dust below 0.05 SOL or 0.01% mint supply','non-reference token transfers','program sponsors outside the eligible holder set'],commonOwnershipEstablished:false};
 }catch{return null;}
}
