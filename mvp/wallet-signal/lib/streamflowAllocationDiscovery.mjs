import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {decodeInstructionBytes} from './liquidityInstructionBytes.mjs';
import {STREAMFLOW_PROGRAM} from './streamflowAllocationControls.mjs';
const TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',SYSTEM='11111111111111111111111111111111',ATA='ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const TOKENS=new Set([TOKEN,'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const discriminators=['create','create_v2'].map(name=>({name,bytes:createHash('sha256').update('global:'+name).digest().subarray(0,8)}));
/** Discover metadata from supported protocol creation evidence. This is separate
 * from proving an exact creator outflow: treasury/partner fees or a different
 * designated token creator must not prevent fresh escrow-control inspection.
 * The caller must still verify current metadata owner, PDA, mint and account.
 */
export function discoverStreamflowAllocation({mint,tokenAccount,transaction:tx}={}){
 try{
  if(!['legacy',0,1].includes(tx?.version)||tx.meta?.err!==null||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime)||!Array.isArray(tx.meta.innerInstructions))return null;
  const message=tx.transaction.message,keys=message.accountKeys.map(k=>typeof k==='string'?k:k.pubkey),signature=tx.transaction.signatures[0];if(!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(signature||''))return null;
  const matches=[];
  for(const [instructionIndex,ix]of message.instructions.entries()){
   if(ix.programId!==STREAMFLOW_PROGRAM||ix.accounts?.length!==18)continue;
   const bytes=decodeInstructionBytes(ix.data),spec=bytes&&discriminators.find(s=>bytes.subarray(0,8).equals(s.bytes));if(!spec)continue;
   const a=ix.accounts;
   if(a[11]!==mint||a[4]!==tokenAccount||a[14]!==STREAMFLOW_PROGRAM||!TOKENS.has(a[15])||a[16]!==ATA||a[17]!==SYSTEM||!message.accountKeys.some(k=>k.pubkey===a[0]&&k.signer===true))continue;
   if(PublicKey.findProgramAddressSync([Buffer.from('strm'),new PublicKey(a[3]).toBuffer()],new PublicKey(STREAMFLOW_PROGRAM))[0].toBase58()!==tokenAccount)continue;
   const metadataIndex=keys.indexOf(a[3]),escrowIndex=keys.indexOf(tokenAccount),group=tx.meta.innerInstructions.find(g=>g.index===instructionIndex)?.instructions;
   if(metadataIndex<0||escrowIndex<0||tx.meta.preBalances[metadataIndex]!==0||tx.meta.preBalances[escrowIndex]!==0||!Array.isArray(group))continue;
   const born=(address,owner,space)=>group.filter(i=>i.programId===SYSTEM&&i.parsed?.type==='createAccount'&&i.parsed.info.newAccount===address&&i.parsed.info.owner===owner&&i.parsed.info.space===space&&i.parsed.info.source===a[0]).length===1;
   if(!born(a[3],STREAMFLOW_PROGRAM,1104)||!born(tokenAccount,a[15],165))continue;
   if(group.filter(i=>i.programId===a[15]&&['initializeAccount','initializeAccount2','initializeAccount3'].includes(i.parsed?.type)&&i.parsed.info.account===tokenAccount&&i.parsed.info.owner===tokenAccount&&i.parsed.info.mint===mint).length!==1)continue;
   const balances=tx.meta.postTokenBalances.filter(b=>keys[b.accountIndex]===tokenAccount);
   if(balances.length!==1||balances[0].mint!==mint||balances[0].owner!==tokenAccount||balances[0].programId!==a[15]||!(/^[0-9]+$/).test(balances[0].uiTokenAmount?.amount||'')||BigInt(balances[0].uiTokenAmount.amount)<=0n||tx.meta.preTokenBalances.some(b=>keys[b.accountIndex]===tokenAccount))continue;
   matches.push({mint,escrow:tokenAccount,metadata:a[3],sender:a[0],tokenProgram:a[15],recipientAtCreation:a[2],signature,slot:tx.slot,instructionIndex,protocolInstruction:spec.name,decoderVersion:'streamflow-create-metadata-binding-v1',scope:'Metadata discovery only; fresh controls required. No creator relationship or sale inferred.',creatorRelationshipEstablished:false});
  }
  return matches.length===1?matches[0]:null;
 }catch{return null;}
}
