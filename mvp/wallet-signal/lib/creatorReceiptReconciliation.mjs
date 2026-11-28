/** Narrow direct SPL incoming-transfer proof. Never classifies purchases or launch allocations. */
const TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ALLOWED=new Set([TOKEN,'11111111111111111111111111111111','ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL','ComputeBudget111111111111111111111111111111']);
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
export function reconcileCreatorReceipt({mint,creator,signature,transaction:tx}={}){
 try{
  if(tx?.meta?.err!==null||tx.transaction?.signatures?.[0]!==signature||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<=0||!['legacy',0,1].includes(tx.version))return null;
  const m=tx.transaction.message,keys=m.accountKeys.map(k=>typeof k==='string'?k:k.pubkey),outer=m.instructions,groups=tx.meta.innerInstructions;
  if(!Array.isArray(groups)||groups.some(g=>!Number.isSafeInteger(g.index)||g.index<0||g.index>=outer.length||!Array.isArray(g.instructions))||new Set(groups.map(g=>g.index)).size!==groups.length)return null;
  const flat=outer.flatMap((ix,index)=>[{ix,index,inner:null},...(groups.find(g=>g.index===index)?.instructions||[]).map((ix,inner)=>({ix,index,inner}))]);
  if(flat.some(x=>!ALLOWED.has(x.ix.programId)))return null;
  const token=flat.filter(x=>x.ix.programId===TOKEN);
  if(token.some(x=>!['transferChecked','initializeAccount3','getAccountDataSize','initializeImmutableOwner'].includes(x.ix.parsed?.type)))return null;
  const moves=token.filter(x=>x.ix.parsed.type==='transferChecked');if(moves.length!==1)return null;
  const p=moves[0],i=p.ix.parsed.info,amount=i.tokenAmount?.amount;
  if(p.inner!==null||i.mint!==mint||!uint(amount)||BigInt(amount)===0n||!Number.isInteger(i.tokenAmount.decimals)||!m.accountKeys.some(k=>k.pubkey===i.authority&&k.signer===true))return null;
  const before=tx.meta.preTokenBalances,after=tx.meta.postTokenBalances;if(!Array.isArray(before)||!Array.isArray(after))return null;
  const source=before.filter(b=>keys[b.accountIndex]===i.source),dest=after.filter(b=>keys[b.accountIndex]===i.destination);
  if(source.length!==1||dest.length!==1||source[0].mint!==mint||source[0].owner===creator||source[0].owner!==i.authority||dest[0].mint!==mint||dest[0].owner!==creator||source[0].programId!==TOKEN||dest[0].programId!==TOKEN)return null;
  const sourceAfter=after.filter(b=>keys[b.accountIndex]===i.source);if(sourceAfter.length!==1||sourceAfter[0].mint!==mint||sourceAfter[0].owner!==i.authority||sourceAfter[0].programId!==TOKEN||!uint(source[0].uiTokenAmount?.amount)||!uint(sourceAfter[0].uiTokenAmount?.amount)||BigInt(source[0].uiTokenAmount.amount)-BigInt(sourceAfter[0].uiTokenAmount.amount)!==BigInt(amount))return null;
  const rows=xs=>xs.filter(b=>b.mint===mint&&b.owner===creator);
  const pre=rows(before),post=rows(after);
  if([...pre,...post].some(b=>b.programId!==TOKEN||!uint(b.uiTokenAmount?.amount)||b.uiTokenAmount.decimals!==i.tokenAmount.decimals)||post.length!==1||pre.length>1)return null;
  if(pre.length&&keys[pre[0].accountIndex]!==i.destination)return null;
  if(!pre.length){const init=token.filter(x=>x.ix.parsed.type==='initializeAccount3'&&x.ix.parsed.info?.account===i.destination&&x.ix.parsed.info.owner===creator&&x.ix.parsed.info.mint===mint&&x.index<p.index);if(init.length!==1)return null;}
  const total=xs=>xs.reduce((n,b)=>n+BigInt(b.uiTokenAmount.amount),0n);
  if(total(post)-total(pre)!==BigInt(amount))return null;
  return {signature,instructionIndex:p.index,innerInstructionIndex:null,mint,creator,type:'EXTERNAL_RECEIPT',timestamp:tx.blockTime,amountRaw:amount,independentlyVerified:true,instructionVerified:true,acquisitionMechanism:'direct_incoming_transfer',purchaseVerified:false};
 }catch{return null;}
}
