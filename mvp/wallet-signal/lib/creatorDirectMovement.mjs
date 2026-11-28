const TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',TOKEN22='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ALLOWED=new Set([TOKEN,TOKEN22,'11111111111111111111111111111111','ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL','ComputeBudget111111111111111111111111111111']);
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
/** Narrow non-market movement. Exact account deltas and transaction signers are
 * required; unknown CPI, mutable ownership, fee shortfalls and swaps fail closed. */
function verifyCreatorDirectReceipt({mint,creator,signature,transaction:tx}={}){
 try{
  if(tx?.meta?.err!==null||tx.transaction?.signatures?.[0]!==signature||!['legacy',0,1].includes(tx.version)||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<=0)return null;
  const m=tx.transaction.message,keys=m.accountKeys.map(k=>typeof k==='string'?k:k.pubkey),outer=m.instructions,groups=tx.meta.innerInstructions;
  if(!Array.isArray(groups)||new Set(groups.map(g=>g.index)).size!==groups.length||groups.some(g=>!Number.isSafeInteger(g.index)||g.index<0||g.index>=outer.length||!Array.isArray(g.instructions)))return null;
  const flat=outer.flatMap((ix,index)=>[{ix,index,inner:null},...(groups.find(g=>g.index===index)?.instructions||[]).map((ix,inner)=>({ix,index,inner}))]);
  if(flat.some(x=>!ALLOWED.has(x.ix.programId)))return null;
  const token=flat.filter(x=>[TOKEN,TOKEN22].includes(x.ix.programId));
  if(token.some(x=>!['transferChecked','mintTo','mintToChecked','initializeAccount','initializeAccount2','initializeAccount3','getAccountDataSize','initializeImmutableOwner','closeAccount'].includes(x.ix.parsed?.type)))return null;
  const moves=token.filter(x=>['transferChecked','mintTo','mintToChecked'].includes(x.ix.parsed.type));if(moves.length!==1)return null;
  const p=moves[0],i=p.ix.parsed.info,isMint=p.ix.parsed.type!=='transferChecked',amount=isMint?i.tokenAmount?.amount??i.amount:i.tokenAmount?.amount,program=p.ix.programId;
  if(p.inner!==null||i.mint!==mint||!uint(amount)||BigInt(amount)===0n)return null;
  const authority=isMint?i.mintAuthority:i.authority;if(!m.accountKeys.some(k=>k.pubkey===authority&&k.signer===true))return null;
  const pre=tx.meta.preTokenBalances,post=tx.meta.postTokenBalances;if(!Array.isArray(pre)||!Array.isArray(post))return null;
  const rows=(xs,address)=>xs.filter(b=>keys[b.accountIndex]===address),before=rows(pre,i.destination||i.account),after=rows(post,i.destination||i.account);
  if(after.length!==1||before.length>1||after[0].mint!==mint||after[0].programId!==program||after[0].owner!==creator||!uint(after[0].uiTokenAmount?.amount))return null;
  const decimals=after[0].uiTokenAmount.decimals;if(!Number.isInteger(decimals)||decimals<0||decimals>255||i.tokenAmount&&i.tokenAmount.decimals!==decimals)return null;
  if(before.some(b=>b.mint!==mint||b.programId!==program||b.owner!==creator||b.uiTokenAmount?.decimals!==decimals||!uint(b.uiTokenAmount.amount)))return null;
  if(!before.length){const init=token.filter(x=>x.ix.parsed.type.startsWith('initializeAccount')&&x.ix.parsed.type!=='initializeImmutableOwner'&&x.ix.parsed.info?.account===(i.destination||i.account)&&x.ix.parsed.info.owner===creator&&x.ix.parsed.info.mint===mint&&x.index<p.index);if(init.length!==1)return null;}
  if(BigInt(after[0].uiTokenAmount.amount)-BigInt(before[0]?.uiTokenAmount.amount||'0')!==BigInt(amount))return null;
  if(!isMint){const a=rows(pre,i.source),b=rows(post,i.source);if(a.length!==1||b.length!==1||a[0].owner===creator||a[0].owner!==authority||b[0].owner!==authority||[...a,...b].some(x=>x.mint!==mint||x.programId!==program||x.uiTokenAmount?.decimals!==decimals||!uint(x.uiTokenAmount.amount))||BigInt(a[0].uiTokenAmount.amount)-BigInt(b[0].uiTokenAmount.amount)!==BigInt(amount))return null;}
  const own=xs=>xs.filter(b=>b.mint===mint&&b.owner===creator);
  if([...own(pre),...own(post)].some(b=>!uint(b.uiTokenAmount?.amount)))return null;
  const sum=xs=>own(xs).reduce((n,b)=>n+BigInt(b.uiTokenAmount.amount),0n);if(sum(post)-sum(pre)!==BigInt(amount))return null;
  return {signature,instructionIndex:p.index,innerInstructionIndex:null,mint,creator,type:isMint?'DIRECT_MINT_RECEIPT':'EXTERNAL_RECEIPT',timestamp:tx.blockTime,amountRaw:amount,independentlyVerified:true,instructionVerified:true,...(isMint?{mintInstructionVerified:true}:{}),purchaseVerified:false,acquisitionMechanism:isMint?'direct_mint_receipt':'direct_incoming_transfer'};
 }catch{return null;}
}

/** Classic SPL Transfer omits the mint. Bind both account owners and mint from
 * exact before/after balance rows. This narrow path permits no CPI or account
 * lifecycle change; an unsupported swap cannot be relabelled as a transfer. */
function verifyPlainCreatorTransfer({mint,creator,signature,transaction:tx}={}){
 try{
  if(tx?.meta?.err!==null||tx.transaction?.signatures?.[0]!==signature||!['legacy',0,1].includes(tx.version)||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<=0)return null;
  const m=tx.transaction.message,keys=m.accountKeys.map(k=>typeof k==='string'?k:k.pubkey),outer=m.instructions;
  if(!Array.isArray(outer)||!Array.isArray(tx.meta.innerInstructions)||tx.meta.innerInstructions.some(g=>g.instructions?.length)||outer.some(ix=>![TOKEN,'11111111111111111111111111111111','ComputeBudget111111111111111111111111111111'].includes(ix.programId)))return null;
  const moves=outer.map((ix,index)=>({ix,index})).filter(x=>x.ix.programId===TOKEN);
  if(moves.length!==1||!['transfer','transferChecked'].includes(moves[0].ix.parsed?.type))return null;
  const {ix,index}=moves[0],i=ix.parsed.info,amount=i.amount??i.tokenAmount?.amount;
  if(!uint(amount)||BigInt(amount)===0n||i.source===i.destination||!m.accountKeys.some(k=>k.pubkey===i.authority&&k.signer===true)||i.mint!==undefined&&i.mint!==mint)return null;
  const row=(name,account)=>{const rows=tx.meta[name]?.filter(b=>keys[b.accountIndex]===account);if(rows?.length!==1)return null;const b=rows[0];return b.mint===mint&&b.programId===TOKEN&&uint(b.uiTokenAmount?.amount)&&Number.isInteger(b.uiTokenAmount.decimals)&&b.uiTokenAmount.decimals>=0&&b.uiTokenAmount.decimals<=255?b:null;};
  const a=row('preTokenBalances',i.source),b=row('postTokenBalances',i.source),c=row('preTokenBalances',i.destination),d=row('postTokenBalances',i.destination);
  if(!a||!b||!c||!d||a.owner!==b.owner||c.owner!==d.owner||a.owner!==i.authority||a.owner===c.owner||[b,c,d].some(x=>x.uiTokenAmount.decimals!==a.uiTokenAmount.decimals)||i.tokenAmount&&i.tokenAmount.decimals!==a.uiTokenAmount.decimals)return null;
  if(BigInt(a.uiTokenAmount.amount)-BigInt(b.uiTokenAmount.amount)!==BigInt(amount)||BigInt(d.uiTokenAmount.amount)-BigInt(c.uiTokenAmount.amount)!==BigInt(amount))return null;
  const incoming=c.owner===creator,outgoing=a.owner===creator;if(incoming===outgoing)return null;
  const own=name=>tx.meta[name].filter(b=>b.mint===mint&&b.owner===creator);
  if([...own('preTokenBalances'),...own('postTokenBalances')].some(b=>!uint(b.uiTokenAmount?.amount)))return null;
  const sum=name=>own(name).reduce((n,b)=>n+BigInt(b.uiTokenAmount.amount),0n);
  if(sum('postTokenBalances')-sum('preTokenBalances')!==(incoming?1n:-1n)*BigInt(amount))return null;
  return {signature,instructionIndex:index,innerInstructionIndex:null,mint,creator,type:incoming?'EXTERNAL_RECEIPT':'EXTERNAL_TRANSFER_OUT',timestamp:tx.blockTime,amountRaw:amount,independentlyVerified:true,instructionVerified:true,purchaseVerified:false,acquisitionMechanism:incoming?'direct_incoming_transfer':undefined};
 }catch{return null;}
}
export function verifyCreatorDirectMovement(input){return verifyCreatorDirectReceipt(input)||verifyPlainCreatorTransfer(input);}
