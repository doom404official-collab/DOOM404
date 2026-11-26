import {decodePumpFunCreate,PUMP_PROGRAM_ID} from './pumpFunCreation.mjs';
/** One indexed earliest transaction is a candidate only. Successful protocol
 * creation, mint-account birth and signers independently establish assigned role. */
export function verifyBoundedCreatorOrigin(transaction,mint){
 try{
  const tx=transaction;if(!["legacy",0,1].includes(tx?.version)||tx?.meta?.err!==null||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<=0||!Array.isArray(tx.transaction?.message?.accountKeys)||!Array.isArray(tx.transaction.message.instructions)||!tx.transaction.signatures?.length)return null;
  const keys=tx.transaction.message.accountKeys,mi=keys.findIndex(k=>k.pubkey===mint);if(mi<0||keys[mi].signer!==true||tx.meta.preBalances?.[mi]!==0||!(tx.meta.postBalances?.[mi]>0))return null;
  const all=[...tx.transaction.message.instructions,...(tx.meta.innerInstructions||[]).flatMap(g=>g.instructions)];
  const births=all.filter(i=>i.programId==='11111111111111111111111111111111'&&i.parsed?.type==='createAccount'&&i.parsed.info?.newAccount===mint&&['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(i.parsed.info.owner));if(births.length!==1)return null;
  const candidates=tx.transaction.message.instructions.flatMap(ix=>{const d=decodePumpFunCreate({instruction:ix,transaction:tx,mint,programId:ix.programId});return d&&keys.some(k=>k.pubkey===d.user&&k.signer===true)?[d]:[];});
  if(candidates.length!==1)return null;const d=candidates[0];
  return {version:2,mint,creator:d.creator,creationUser:d.user,role:'protocol_assigned_creator',verified:true,verification:'transaction_local_protocol_creator',creationSlot:tx.slot,creationTime:tx.blockTime,creationSignature:tx.transaction.signatures[0],decoderVersion:d.decoderVersion,programId:PUMP_PROGRAM_ID,independentlyReviewed:false,scope:'Assigned on-chain creator role; does not establish off-chain identity or ownership of other wallets.'};
 }catch{return null;}
}
