/** Read-only creator attribution resolution from persisted, evidence-backed data.
 * Never upgrades an on-chain match to independently reviewed.
 * No external RPC is performed on a valid cached match.
 */
const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const signature=/^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const supported=new Set(["VERIFIED","ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"]);
export async function resolveCachedCreator({mint,vault}){
 if(!address.test(mint||""))throw Error("INVALID_MINT");
 if(!vault?.getAttribution||!vault?.getCreatorEvidence)throw Error("VAULT_REQUIRED");
 const record=await vault.getAttribution(mint);
 if(!record)return {status:"CACHE_MISS",creator:null,evidence:[]};
 if(record.status==="CONFLICT")return {status:"CONFLICT",creator:null,evidence:[]};
 if(!supported.has(record.status)){
  return {status:"INDEXED_UNVERIFIED",creator:address.test(record.indexed_creator||"")?record.indexed_creator:null,evidence:[]};
 }
 const creator=record.verified_creator;
 if(!address.test(creator||"")||!signature.test(record.creation_signature||""))
  return {status:"EVIDENCE_INCOMPLETE",creator:null,evidence:[]};
 const rows=await vault.getCreatorEvidence(mint);
 const matches=rows.filter(row=>row.mint===mint&&row.signature===record.creation_signature&&
  row.decoded_creator===creator&&row.program_id===record.program_id&&
  row.decoder_version===record.decoder_version&&row.verification_status==="DECODED_MATCH");
 if(matches.length!==1)return {status:"EVIDENCE_INCOMPLETE",creator:null,evidence:[]};
 return {status:record.status,creator,evidence:[{
  signature:record.creation_signature,programId:record.program_id,
  decoderVersion:record.decoder_version}],source:"INTELLIGENCE_VAULT",
  independentlyReviewed:record.status==="VERIFIED"};
}
