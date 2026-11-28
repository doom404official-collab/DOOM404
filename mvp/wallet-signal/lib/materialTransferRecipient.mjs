import {classifyHolderAllocations} from './holderAllocationClassification.mjs';
const TOKENS=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
/** Recover a recipient relationship from an already-verified material transfer.
 * It never asserts a sale, beneficial ownership or creator control. */
export function materialTransferRecipient({mint,creator,event,transaction:tx,supplyRaw}={}){
 try{
  if(event?.type!=='EXTERNAL_TRANSFER_OUT'||event.mint!==mint||event.creator!==creator||event.independentlyVerified!==true||event.instructionVerified!==true||!uint(event.amountRaw)||!uint(supplyRaw)||BigInt(supplyRaw)===0n||BigInt(event.amountRaw)*100n<BigInt(supplyRaw)*5n||tx?.meta?.err!==null||tx.transaction?.signatures?.[0]!==event.signature||!Number.isSafeInteger(tx.slot))return null;
  const keys=tx.transaction.message.accountKeys.map(k=>typeof k==='string'?k:k.pubkey),ix=event.innerInstructionIndex==null?tx.transaction.message.instructions[event.instructionIndex]:tx.meta.innerInstructions.find(g=>g.index===event.instructionIndex)?.instructions[event.innerInstructionIndex],i=ix?.parsed?.info;
  if(!TOKENS.has(ix?.programId)||!['transfer','transferChecked'].includes(ix.parsed?.type)||String(i.tokenAmount?.amount??i.amount)!==event.amountRaw||i.mint!==undefined&&i.mint!==mint)return null;
  const rows=(name,account)=>tx.meta[name].filter(b=>keys[b.accountIndex]===account),source=rows('preTokenBalances',i.source),sourceAfter=rows('postTokenBalances',i.source),destination=rows('postTokenBalances',i.destination);
  if(source.length!==1||sourceAfter.length!==1||destination.length!==1||source[0].owner!==creator||sourceAfter[0].owner!==creator||destination[0].owner===creator||[...source,...sourceAfter,...destination].some(b=>b.mint!==mint||b.programId!==ix.programId||!uint(b.uiTokenAmount?.amount))||BigInt(source[0].uiTokenAmount.amount)-BigInt(sourceAfter[0].uiTokenAmount.amount)!==BigInt(event.amountRaw))return null;
  return {mint,creator,signature:event.signature,slot:tx.slot,instructionIndex:event.instructionIndex,innerInstructionIndex:event.innerInstructionIndex??null,sourceTokenAccount:i.source,destinationTokenAccount:i.destination,recipientAuthorityAtTransfer:destination[0].owner,amountRaw:event.amountRaw,decimals:source[0].uiTokenAmount.decimals,tokenProgram:ix.programId,classification:'verified_external_transfer',saleEstablished:false,recipientCreatorControlEstablished:false};
 }catch{return null;}
}
export async function investigateMaterialRecipient({target,read,now=Date.now,minContextSlot=0,largestSampleTokenAccount=null}={}){
 const out={...target,status:'current_recipient_unresolved',currentObservation:null,historyComplete:false,subsequentMovementsComplete:false,recipientCreatorControlEstablished:false};
 try{
  const r=await read('getMultipleAccounts',[[target.mint,target.destinationTokenAccount,target.recipientAuthorityAtTransfer],{encoding:'jsonParsed',commitment:'finalized',minContextSlot}]);
  if(!Number.isSafeInteger(r?.context?.slot)||r.context.slot<minContextSlot||r.value?.length!==3)return out;
  const [mint,token,authority]=r.value,m=mint?.data?.parsed?.info,t=token?.data?.parsed?.info;
  if(mint?.executable!==false||!TOKENS.has(mint.owner)||mint.data.parsed.type!=='mint'||m?.isInitialized!==true||!uint(m.supply)||BigInt(m.supply)===0n||token?.executable!==false||!TOKENS.has(token.owner)||token.data.parsed.type!=='account'||t?.mint!==target.mint||!uint(t.tokenAmount?.amount)||BigInt(t.tokenAmount.amount)>BigInt(m.supply))return out;
  const classification=classifyHolderAllocations({mint:target.mint,supplyRaw:m.supply,accounts:[{pubkey:target.destinationTokenAccount,account:token}],ownerAccounts:new Map([[target.recipientAuthorityAtTransfer,authority]]),mintInfo:m});
  return {...out,status:'current_recipient_observed',currentObservation:{observedAt:new Date(now()).toISOString(),slot:r.context.slot,tokenAccount:target.destinationTokenAccount,authority:t.owner,authorityUnchanged:t.owner===target.recipientAuthorityAtTransfer,amountRaw:t.tokenAmount.amount,supplyRaw:m.supply,supplyPct:Number(BigInt(t.tokenAmount.amount)*100000000n/BigInt(m.supply))/1000000,classification:classification.allocations[0],sameAccountAsSampledLargest:largestSampleTokenAccount===null?null:target.destinationTokenAccount===largestSampleTokenAccount,overlapScope:'Account address comparison only; linked or beneficial ownership is not established.'},limitations:['Current recipient account is refreshed independently from the historical transfer.','No creator ownership or sale inferred; subsequent account histories remain bounded and incomplete.']};
 }catch{return out;}
}
