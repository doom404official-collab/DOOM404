import {verifyLaunchLabCreator} from './launchLabCreatorOrigin.mjs';
import {decodePumpFunCreate,PUMP_PROGRAM_ID} from './pumpFunCreation.mjs';
/** One indexed earliest transaction is a candidate only. Successful protocol
 * creation, mint-account birth and signers independently establish assigned role. */
export function verifyBoundedCreatorOrigin(transaction,mint){
 try{
  const tx=transaction;if(!["legacy",0,1].includes(tx?.version)||tx?.meta?.err!==null||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<=0||!Array.isArray(tx.transaction?.message?.accountKeys)||!Array.isArray(tx.transaction.message.instructions)||!tx.transaction.signatures?.length)return null;
  const keys=tx.transaction.message.accountKeys,mi=keys.findIndex(k=>k.pubkey===mint);if(mi<0||keys[mi].signer!==true||tx.meta.preBalances?.[mi]!==0||!(tx.meta.postBalances?.[mi]>0))return null;
  const all=[...tx.transaction.message.instructions,...(tx.meta.innerInstructions||[]).flatMap(g=>g.instructions)];
  const births=all.filter(i=>i.programId==='11111111111111111111111111111111'&&i.parsed?.type==='createAccount'&&i.parsed.info?.newAccount===mint&&['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(i.parsed.info.owner));if(births.length!==1)return null;
  const initialization=all.filter(i=>i.programId===births[0].parsed.info.owner&&['initializeMint','initializeMint2'].includes(i.parsed?.type)&&i.parsed.info?.mint===mint);if(initialization.length!==1||!Number.isInteger(initialization[0].parsed.info.decimals)||initialization[0].parsed.info.decimals<0||initialization[0].parsed.info.decimals>255)return null;
  const candidates=all.flatMap(ix=>{const d=decodePumpFunCreate({instruction:ix,transaction:tx,mint,programId:ix.programId});return d&&keys.some(k=>k.pubkey===d.user&&k.signer===true)?[d]:[];});
  if(candidates.length===0)return verifyLaunchLabCreator(tx,mint);
  if(candidates.length!==1)return null;const d=candidates[0];
  return {version:2,mint,creator:d.creator,creationUser:d.user,role:'protocol_assigned_creator',verified:true,verification:'transaction_local_protocol_creator',creationSlot:tx.slot,creationTime:tx.blockTime,creationSignature:tx.transaction.signatures[0],decoderVersion:d.decoderVersion,programId:PUMP_PROGRAM_ID,independentlyReviewed:false,attributionMethod:'decoded_launch_instruction_and_transaction_local_mint_birth',evidenceConfidence:'verified_transaction_local_protocol_role',initialMintAuthority:initialization[0].parsed.info.mintAuthority??null,observedAt:new Date(tx.blockTime*1000).toISOString(),scope:'Assigned on-chain creator role; does not establish off-chain identity or ownership of other wallets.'};
 }catch{return null;}
}

/** Explain a rejected transaction without inventing a creator or treating an
 * indexed window as proof that the launch protocol itself is unsupported. */
export function diagnoseBoundedCreatorOrigin(tx,mint){
 const proof=verifyBoundedCreatorOrigin(tx,mint);if(proof)return {status:'verified',reason:'verified_protocol_creator_role',signature:proof.creationSignature,slot:proof.creationSlot};
 const signature=typeof tx?.transaction?.signatures?.[0]==='string'?tx.transaction.signatures[0]:null,slot=Number.isSafeInteger(tx?.slot)?tx.slot:null;
 const out=reason=>({status:'unresolved',reason,signature,slot});
 try{
  if(!['legacy',0,1].includes(tx?.version))return out('transaction_version_unsupported');
  if(tx.meta?.err!==null||!Array.isArray(tx.transaction?.message?.accountKeys)||!Array.isArray(tx.transaction.message.instructions))return out('transaction_context_incomplete');
  const keys=tx.transaction.message.accountKeys,mi=keys.findIndex(k=>k.pubkey===mint);
  if(mi<0)return out('mint_not_in_transaction_keys');
  if(tx.meta.preBalances?.[mi]!==0||!(tx.meta.postBalances?.[mi]>0))return out('original_mint_birth_not_in_transaction');
  const all=[...tx.transaction.message.instructions,...(tx.meta.innerInstructions||[]).flatMap(g=>g.instructions||[])];
  const births=all.filter(i=>i.programId==='11111111111111111111111111111111'&&i.parsed?.type==='createAccount'&&i.parsed.info?.newAccount===mint&&['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(i.parsed.info.owner));
  if(births.length!==1)return out('mint_account_birth_instruction_unverified');
  if(keys[mi].signer!==true)return out('mint_birth_signer_requirement_not_met');
  const init=all.filter(i=>i.programId===births[0].parsed.info.owner&&['initializeMint','initializeMint2'].includes(i.parsed?.type)&&i.parsed.info?.mint===mint);
  if(init.length!==1)return out('mint_initialization_unverified');
  if(all.some(i=>i.programId===PUMP_PROGRAM_ID))return out('pump_creation_layout_or_creator_proof_inconclusive');
  if(all.some(i=>i.programId==='LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj'))return out('launchlab_creation_layout_or_creator_proof_inconclusive');
  return out('mint_initializer_observed_creator_role_not_established');
 }catch{return out('transaction_context_incomplete');}
}
export function creatorOriginLimitation(diagnostics=[]){
 if(!diagnostics.length)return 'original_launch_transaction_unavailable';
 if(diagnostics.some(d=>['pump_creation_layout_or_creator_proof_inconclusive','launchlab_creation_layout_or_creator_proof_inconclusive'].includes(d.reason)))return 'creator_attribution_evidence_inconclusive';
 if(diagnostics.some(d=>d.reason==='mint_initializer_observed_creator_role_not_established'))return 'creator_role_not_established_from_mint_initialization';
 if(diagnostics.every(d=>['original_mint_birth_not_in_transaction','mint_not_in_transaction_keys'].includes(d.reason)))return 'original_launch_transaction_not_in_returned_window';
 return 'original_launch_transaction_proof_incomplete';
}
