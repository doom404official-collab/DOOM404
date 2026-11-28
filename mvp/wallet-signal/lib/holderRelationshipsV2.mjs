import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
export function projectHolderRelationshipsV2(row,mint){
 try{
  const c=row?.checkpoint;
  if(!row||row.mint!==mint||c?.mint!==mint||c.snapshot?.canonicalSchemaVersion!==2||c.snapshot?.hashAlgorithm!=='sha256-ordered-eligible-wallet-token-accounts-v2'||!/^[a-f0-9]{64}$/.test(c.snapshot.id||'')||!Number.isSafeInteger(c.snapshot.slot)||c.snapshot.slot<0||c.holders?.length!==20||!Array.isArray(c.networkEvidence?.transfers))return null;
  const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
  if(!uint(c.snapshot.supplyRaw)||BigInt(c.snapshot.supplyRaw)===0n)return null;
  const accounts=new Set();for(const h of c.holders){new PublicKey(h.ownerWallet);if(!uint(h.amountRaw)||!Array.isArray(h.tokenAccounts)||!h.tokenAccounts.length)return null;let sum=0n;for(const t of h.tokenAccounts){new PublicKey(t.tokenAccount);if(accounts.has(t.tokenAccount)||!uint(t.amountRaw))return null;accounts.add(t.tokenAccount);sum+=BigInt(t.amountRaw);}if(sum.toString()!==h.amountRaw)return null;}
  const hash=createHash('sha256').update(JSON.stringify({version:2,mint,holders:c.holders.map(h=>[h.ownerWallet,h.tokenAccounts.map(t=>t.tokenAccount)])})).digest('hex');
  if(hash!==row.holder_set_hash||hash!==c.snapshot.holderSetHash)return null;
  const wallets=new Map(c.holders.map(h=>[h.ownerWallet,BigInt(h.amountRaw)]));if(wallets.size!==20||[...wallets.values()].reduce((n,a)=>n+a,0n)>BigInt(c.snapshot.supplyRaw))return null;
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
  return {version:2,mint,holderSetHash:hash,snapshotSlot:c.snapshot.slot,connectedExposurePct:Number(exposure*1000000n/supply)/10000,relationships:edges,relationshipCount:new Set(edges.map(e=>[e.from,e.to].sort().join('|'))).size,connectedWalletCount:members.size,historyComplete:false,coverageScope:'Retained individually verified transactions, not an exhaustive historical window.',excluded:['dust below 0.05 SOL or 0.01% mint supply','non-reference token transfers','program sponsors outside the eligible holder set'],commonOwnershipEstablished:false};
 }catch{return null;}
}
