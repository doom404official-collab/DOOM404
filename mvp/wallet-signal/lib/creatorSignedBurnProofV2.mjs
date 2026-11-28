import {verify} from 'node:crypto';
import {PublicKey,Message,MessageV0} from '@solana/web3.js';
import {decodeBase58Bytes,encodeBase58Bytes} from './pumpFunCreation.mjs';
/** Reconstruct the signed message for the narrow burn proof. This authenticates
 * the instruction; execution/finalization and balances still come from RPC. */
export function verifySignedBurnInstructionV2(tx){
 try{
  if(![0,'legacy'].includes(tx?.version))return false;
  const m=tx.transaction.message,keys=m.accountKeys;
  if(!Array.isArray(keys)||keys.some(k=>!k.pubkey||typeof k.signer!=='boolean'||typeof k.writable!=='boolean'||k.source&&k.source!=='transaction')||m.addressTableLookups?.length)return false;
  const index=x=>{const i=keys.findIndex(k=>k.pubkey===x);if(i<0)throw Error();return i;};let burns=0;
  const instructions=m.instructions.map(i=>{
   let data,accounts;
   if(i.parsed?.type==='burnChecked'&&i.programId==='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'){
    burns++;const info=i.parsed.info;if(!/^[0-9]+$/.test(info.tokenAmount?.amount||'')||!Number.isInteger(info.tokenAmount.decimals))throw Error();
    data=Buffer.alloc(10);data[0]=15;data.writeBigUInt64LE(BigInt(info.tokenAmount.amount),1);data[9]=info.tokenAmount.decimals;
    accounts=[info.account,info.mint,info.authority].map(index);
   }else if(i.programId==='ComputeBudget111111111111111111111111111111'&&Array.isArray(i.accounts)&&typeof i.data==='string'){data=decodeBase58Bytes(i.data);accounts=i.accounts.map(index);}else throw Error();
   return {programIdIndex:index(i.programId),accountKeyIndexes:accounts,data};
  });
  if(burns!==1)return false;
  const header={numRequiredSignatures:keys.filter(k=>k.signer).length,numReadonlySignedAccounts:keys.filter(k=>k.signer&&!k.writable).length,numReadonlyUnsignedAccounts:keys.filter(k=>!k.signer&&!k.writable).length};
  if(tx.transaction.signatures.length!==header.numRequiredSignatures)return false;
  const message=tx.version===0?new MessageV0({header,staticAccountKeys:keys.map(k=>new PublicKey(k.pubkey)),recentBlockhash:m.recentBlockhash,compiledInstructions:instructions,addressTableLookups:[]}):new Message({header,accountKeys:keys.map(k=>k.pubkey),recentBlockhash:m.recentBlockhash,instructions:instructions.map(i=>({programIdIndex:i.programIdIndex,accounts:i.accountKeyIndexes,data:encodeBase58Bytes(i.data)}))});
  const serialized=message.serialize();
  return tx.transaction.signatures.every((s,i)=>{const key=Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),new PublicKey(keys[i].pubkey).toBuffer()]);const signature=decodeBase58Bytes(s);return signature.length===64&&verify(null,serialized,{key,format:'der',type:'spki'},signature);});
 }catch{return false;}
}
