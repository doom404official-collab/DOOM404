/** Prepare a database evidence write from a strictly decoded on-chain match.
 * This module never performs I/O and never claims independent review.
 */
const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const signature=/^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
export function prepareCreatorEvidenceWrite({mint,indexedCreator,creationSignature,proof}){
 if(!address.test(mint||"")||!address.test(indexedCreator||"")||
    !signature.test(creationSignature||"")||proof?.status!=="VERIFIED")return null;
 const roles=(proof.decodedRoles||[]).filter(r=>
   r.role==="launchpad_creator"&&r.verifiedInstruction===true&&
   r.mint===mint&&r.signature===creationSignature&&
   address.test(r.address||"")&&address.test(r.programId||"")&&
   typeof r.decoderVersion==="string"&&r.decoderVersion.length>0&&r.decoderVersion.length<=120);
 if(roles.length!==1||roles[0].address!==indexedCreator)return null;
 const r=roles[0];
 return Object.freeze({p_mint:mint,p_creator:r.address,p_signature:creationSignature,
  p_program_id:r.programId,p_decoder_version:r.decoderVersion,
  p_fee_payer:null,p_creator_is_signer:null,p_instruction_hash:null});
}
