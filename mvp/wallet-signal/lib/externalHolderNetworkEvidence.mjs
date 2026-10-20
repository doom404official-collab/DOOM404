/** Read-only inventory of separately persisted network extractions.
 * Never merges into a leased checkpoint or promotes a score.
 */
export function summarizeExternalHolderNetworkEvidence({checkpoint,evidenceRows=[]}={}){
 if(!checkpoint||!checkpoint.signatures||!Array.isArray(evidenceRows))throw Error("INVALID_EXTERNAL_NETWORK_INPUT");
 const retained=checkpoint.networkEvidence?.processed??{};
 const seen=new Set(),counts={rows:0,alreadyInCheckpoint:0,eligibleForReview:0,invalid:0,unresolved:0,notChecked:0,duplicateRows:0,transferRecords:0};
 for(const row of evidenceRows){
  const sig=row?.signature;
  if(typeof sig!=="string"||!sig){counts.invalid++;continue;}
  if(seen.has(sig)){counts.duplicateRows++;continue;}seen.add(sig);counts.rows++;
  if(checkpoint.signatures[sig]!=="checked"){counts.notChecked++;continue;}
  if(Object.hasOwn(retained,sig)){counts.alreadyInCheckpoint++;continue;}
  const e=row?.evidence?.networkExtraction;
  if(e?.version!==1||e.valid!==true||!Array.isArray(e.transfers)){counts.invalid++;continue;}
  if(!Number.isSafeInteger(e.unresolvedTokenTransfers)||e.unresolvedTokenTransfers!==0){counts.unresolved++;continue;}
  if(e.transfers.some(t=>t?.signature!==sig||t?.verifiedOnChain!==true||t?.transferVerified!==true)){counts.invalid++;continue;}
  counts.eligibleForReview++;counts.transferRecords+=e.transfers.length;
 }
 return {...counts,checkpointModified:false,scorePromoted:false,
  note:"Eligibility for review is not authorization to merge: snapshot identity, transfer completeness and atomic checkpoint version must be validated first."};
}
