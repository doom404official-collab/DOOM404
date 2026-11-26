import {extractHolderNetworkTransfers} from './holderNetworkTransfers.mjs';
import {PublicKey} from '@solana/web3.js';
const TOKEN='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',SYSTEM='11111111111111111111111111111111',ATA='ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',COMPUTE='ComputeBudget111111111111111111111111111111';
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
/** Narrow non-swap outflow proof. Burns and transfers never become sales; an
 * external recipient means outside the attributed wallet set, not proven independence. */
export function reconcileCreatorNonSaleOutflow({mint,creator,signature,transaction:tx}={}){
 const fail=reason=>({status:'UNVERIFIED',reason,event:null});
 try{
  if(tx?.transaction?.signatures?.[0]!==signature||!Number.isSafeInteger(tx.slot)||tx.slot<0||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<=0||tx.meta?.err!==null||!['legacy',0,1].includes(tx.version))return fail('TRANSACTION_IDENTITY_UNVERIFIED');
  const message=tx.transaction.message,keys=message.accountKeys.map(k=>typeof k==='string'?k:k.pubkey),outer=message.instructions,groups=tx.meta.innerInstructions;
  if(!message.accountKeys.some(k=>k.pubkey===creator&&k.signer===true)||!Array.isArray(groups)||new Set(groups.map(g=>g.index)).size!==groups.length||groups.some(g=>!Number.isSafeInteger(g.index)||g.index<0||g.index>=outer.length||!Array.isArray(g.instructions)))return fail('INSTRUCTION_CONTEXT_UNVERIFIED');
  const flat=outer.flatMap((ix,instructionIndex)=>[{ix,instructionIndex,innerInstructionIndex:null},...(groups.find(g=>g.index===instructionIndex)?.instructions??[]).map((ix,innerInstructionIndex)=>({ix,instructionIndex,innerInstructionIndex}))]);
  if(flat.some(x=>![TOKEN,SYSTEM,ATA,COMPUTE].includes(x.ix.programId)))return fail('NON_SALE_CONTEXT_UNVERIFIED');
  const token=flat.filter(x=>x.ix.programId===TOKEN),allowed=['getAccountDataSize','initializeImmutableOwner','initializeAccount3','transferChecked','burnChecked'];
  if(token.some(x=>!allowed.includes(x.ix.parsed?.type)))return fail('TOKEN_LIFECYCLE_UNSUPPORTED');
  const principal=token.filter(x=>['transferChecked','burnChecked'].includes(x.ix.parsed.type));
  if(principal.length!==1)return fail('AMBIGUOUS_TOKEN_OUTFLOW');const p=principal[0],i=p.ix.parsed.info,burn=p.ix.parsed.type==='burnChecked',source=burn?i.account:i.source;
  if(p.innerInstructionIndex!==null||i.authority!==creator||i.mint!==mint||i.tokenAmount?.decimals!==6||!uint(i.tokenAmount.amount)||BigInt(i.tokenAmount.amount)<=0n)return fail('OUTFLOW_INSTRUCTION_UNVERIFIED');
  const rows=name=>tx.meta[name].filter(b=>b.mint===mint&&b.owner===creator);const before=rows('preTokenBalances'),after=rows('postTokenBalances');
  if(before.length!==1||after.length!==1||keys[before[0].accountIndex]!==source||keys[after[0].accountIndex]!==source||before[0].programId!==TOKEN||after[0].programId!==TOKEN||!uint(before[0].uiTokenAmount?.amount)||!uint(after[0].uiTokenAmount?.amount)||BigInt(before[0].uiTokenAmount.amount)-BigInt(after[0].uiTokenAmount.amount)!==BigInt(i.tokenAmount.amount))return fail('CREATOR_OUTFLOW_BALANCE_MISMATCH');
  let recipient=null;
  if(!burn){
   const parsed=extractHolderNetworkTransfers({transaction:tx,signature});
   const transfers=parsed.transfers.filter(t=>t.outerInstructionIndex===p.instructionIndex&&t.innerInstructionIndex===null&&t.sourceTokenAccount===source&&t.destinationTokenAccount===i.destination&&t.mint===mint&&t.from===creator&&t.amountRaw===i.tokenAmount.amount);
   if(parsed.valid&&parsed.unresolvedTokenTransfers===0&&transfers.length===1)recipient=transfers[0].to;
   else {
    // The shared holder decoder intentionally rejects lifecycle-changing accounts.
    // Prove this narrow new-ATA timeline separately; never relax its general guard.
    const dest=tx.meta.postTokenBalances.filter(b=>keys[b.accountIndex]===i.destination);
    const initialized=token.filter(x=>x.ix.parsed.type==='initializeAccount3'&&x.ix.parsed.info.account===i.destination);
    const created=flat.filter(x=>x.ix.programId===SYSTEM&&x.ix.parsed?.type==='createAccount'&&x.ix.parsed.info.newAccount===i.destination);
    const associated=flat.filter(x=>x.ix.programId===ATA&&['create','createIdempotent'].includes(x.ix.parsed?.type)&&x.ix.parsed.info.account===i.destination);
    if(!parsed.valid||dest.length!==1||initialized.length!==1||created.length!==1||associated.length!==1||tx.meta.preTokenBalances.some(b=>keys[b.accountIndex]===i.destination))return fail('TRANSFER_OWNERSHIP_UNVERIFIED');
    const d=dest[0],init=initialized[0],birth=created[0],ata=associated[0],di=init.ix.parsed.info,ai=ata.ix.parsed.info;
    if(init.instructionIndex>=p.instructionIndex||birth.instructionIndex!==init.instructionIndex||ata.instructionIndex!==init.instructionIndex||birth.innerInstructionIndex>=init.innerInstructionIndex||birth.ix.parsed.info.owner!==TOKEN||birth.ix.parsed.info.space!==170||di.mint!==mint||di.owner!==d.owner||d.programId!==TOKEN||d.mint!==mint||d.uiTokenAmount.amount!==i.tokenAmount.amount||ai.mint!==mint||ai.wallet!==d.owner||ai.tokenProgram!==TOKEN)return fail('NEW_ATA_TIMELINE_UNVERIFIED');
    const derived=PublicKey.findProgramAddressSync([new PublicKey(d.owner).toBuffer(),new PublicKey(TOKEN).toBuffer(),new PublicKey(mint).toBuffer()],new PublicKey(ATA))[0].toBase58();
    if(derived!==i.destination)return fail('NEW_ATA_IDENTITY_MISMATCH');recipient=d.owner;
   }
   if(recipient===creator)return fail('INTERNAL_TRANSFER_NOT_EXTERNAL');
  }
  const event={signature,instructionIndex:p.instructionIndex,innerInstructionIndex:null,mint,creator,type:burn?'VERIFIED_BURN':'EXTERNAL_TRANSFER_OUT',timestamp:tx.blockTime,amountRaw:i.tokenAmount.amount,independentlyVerified:true,instructionVerified:true,...(burn?{burnInstructionVerified:true}:{})};
  return {version:1,status:'VERIFIED_NON_SALE_OUTFLOW',signature,slot:tx.slot,event,sourceTokenAccount:source,recipient,recipientCommonOwnershipEstablished:false,verifiedSale:false,historyComplete:false,scoreEligible:false};
 }catch{return fail('MALFORMED_OUTFLOW_TRANSACTION');}
}
