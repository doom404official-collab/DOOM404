import {verify} from 'node:crypto';
import {PublicKey,Message,MessageV0} from '@solana/web3.js';
import {decodeBase58Bytes,encodeBase58Bytes} from './pumpFunCreation.mjs';
const TOKENS=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
/** Authenticate an outer SPL burn and the complete signed message, including
 * unrelated raw annotation instructions. No CPI or lookup-table reconstruction
 * is claimed. Source and wallet token boundaries must corroborate the burn. */
export function verifyCreatorSignedBurn({mint,creator,signature,transaction:tx}={}){
 try{
  if(![0,'legacy'].includes(tx?.version)||tx.meta?.err!==null||tx.transaction?.signatures?.[0]!==signature||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<=0||!Array.isArray(tx.meta.innerInstructions)||tx.meta.innerInstructions.some(g=>g.instructions?.length))return null;
  const m=tx.transaction.message,keys=m.accountKeys;if(!Array.isArray(keys)||keys.length>256||new Set(keys.map(k=>k.pubkey)).size!==keys.length||keys.some(k=>typeof k.pubkey!=='string'||typeof k.signer!=='boolean'||typeof k.writable!=='boolean'||k.source&&k.source!=='transaction')||m.addressTableLookups?.length||!keys.some(k=>k.pubkey===creator&&k.signer))return null;
  const burns=m.instructions.map((ix,index)=>({ix,index})).filter(p=>TOKENS.has(p.ix.programId)&&['burn','burnChecked'].includes(p.ix.parsed?.type));if(burns.length!==1)return null;
  const {ix,index}=burns[0],i=ix.parsed.info,amount=i.tokenAmount?.amount??i.amount;if(i.mint!==mint||i.authority!==creator||!uint(amount)||BigInt(amount)<=0n)return null;
  const row=name=>tx.meta[name].filter(b=>keys[b.accountIndex]?.pubkey===i.account),pre=row('preTokenBalances'),post=row('postTokenBalances');if(pre.length!==1||post.length!==1)return null;
  const decimals=pre[0].uiTokenAmount?.decimals;if(!Number.isInteger(decimals)||decimals<0||decimals>255||i.tokenAmount&&i.tokenAmount.decimals!==decimals||[...pre,...post].some(b=>b.mint!==mint||b.owner!==creator||b.programId!==ix.programId||b.uiTokenAmount?.decimals!==decimals||!uint(b.uiTokenAmount.amount))||BigInt(pre[0].uiTokenAmount.amount)-BigInt(post[0].uiTokenAmount.amount)!==BigInt(amount))return null;
  const owned=name=>{const seen=new Set();return tx.meta[name].filter(b=>b.mint===mint&&b.owner===creator).reduce((n,b)=>{if(seen.has(b.accountIndex)||b.programId!==ix.programId||b.uiTokenAmount?.decimals!==decimals||!uint(b.uiTokenAmount.amount))throw Error();seen.add(b.accountIndex);return n+BigInt(b.uiTokenAmount.amount);},0n);};if(owned('preTokenBalances')-owned('postTokenBalances')!==BigInt(amount))return null;
  const keyIndex=address=>{const n=keys.findIndex(k=>k.pubkey===address);if(n<0)throw Error();return n;};
  const instructions=m.instructions.map(p=>{let data,accounts;if(p===ix){const checked=ix.parsed.type==='burnChecked';data=Buffer.alloc(checked?10:9);data[0]=checked?15:8;data.writeBigUInt64LE(BigInt(amount),1);if(checked)data[9]=decimals;accounts=[i.account,mint,creator].map(keyIndex);}else if(!p.parsed&&!TOKENS.has(p.programId)&&Array.isArray(p.accounts)&&typeof p.data==='string'&&p.data.length<=4096){data=decodeBase58Bytes(p.data);accounts=p.accounts.map(keyIndex);}else throw Error();return {programIdIndex:keyIndex(p.programId),accountKeyIndexes:accounts,data};});
  const header={numRequiredSignatures:keys.filter(k=>k.signer).length,numReadonlySignedAccounts:keys.filter(k=>k.signer&&!k.writable).length,numReadonlyUnsignedAccounts:keys.filter(k=>!k.signer&&!k.writable).length};if(tx.transaction.signatures.length!==header.numRequiredSignatures)return null;
  const signed=tx.version===0?new MessageV0({header,staticAccountKeys:keys.map(k=>new PublicKey(k.pubkey)),recentBlockhash:m.recentBlockhash,compiledInstructions:instructions,addressTableLookups:[]}):new Message({header,accountKeys:keys.map(k=>k.pubkey),recentBlockhash:m.recentBlockhash,instructions:instructions.map(p=>({programIdIndex:p.programIdIndex,accounts:p.accountKeyIndexes,data:encodeBase58Bytes(p.data)}))});
  const bytes=signed.serialize();if(!tx.transaction.signatures.every((s,n)=>{const key=Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),new PublicKey(keys[n].pubkey).toBuffer()]),signature=decodeBase58Bytes(s);return signature.length===64&&verify(null,bytes,{key,format:'der',type:'spki'},signature);}))return null;
  return {mint,creator,signature,slot:tx.slot,timestamp:tx.blockTime,instructionIndex:index,innerInstructionIndex:null,type:'VERIFIED_BURN',amountRaw:amount,decimals,tokenProgram:ix.programId,sourceTokenAccount:i.account,independentlyVerified:true,instructionVerified:true,burnInstructionVerified:true,signatureVerified:true,decoderVersion:'signed-token-burn-boundary-v3',historyComplete:false};
 }catch{return null;}
}
