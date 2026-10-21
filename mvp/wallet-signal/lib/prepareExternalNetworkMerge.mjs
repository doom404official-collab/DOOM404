import {NETWORK_RETENTION_LIMITS} from "./holderNetworkCheckpoint.mjs";
import {validNetworkAddress,validNetworkSignature} from "./holderNetworkTransfers.mjs";
const identity=c=>JSON.stringify({mint:c.mint,snapshot:c.snapshot??null,holders:(c.holders??[]).map(h=>({ownerWallet:h.ownerWallet,tokenAccount:h.tokenAccount,amountRaw:h.amountRaw,sharePct:h.sharePct}))});
/** Pure, fail-closed preparation. Caller must obtain lease and versioned commit separately. */
export function prepareExternalNetworkMerge({checkpoint,evidenceRows=[]}={}){
 if(!checkpoint||!Array.isArray(evidenceRows)||!checkpoint.networkEvidence||checkpoint.networkEvidence.version!==1)
  throw Error("NETWORK_MERGE_INVALID_INPUT");
 const source=checkpoint.networkEvidence;
 if(source.snapshotIdentity!==identity(checkpoint)||source.retentionLimited!==false||!source.processed||!Array.isArray(source.transfers))
  throw Error("NETWORK_MERGE_SNAPSHOT_OR_RETENTION_INVALID");
 const additions=[],seen=new Set();
 for(const row of evidenceRows){
  const signature=row?.signature,ex=row?.evidence?.networkExtraction;
  if(!validNetworkSignature(signature)||seen.has(signature))throw Error("NETWORK_MERGE_SIGNATURE_INVALID");
  seen.add(signature);
  if(checkpoint.signatures?.[signature]!=="checked"||Object.hasOwn(source.processed,signature))continue;
  if(row?.status!=="verified")continue;
  if(ex?.version!==1||ex.valid!==true||ex.unresolvedTokenTransfers!==0||!Array.isArray(ex.transfers))
   continue;
  for(const t of ex.transfers){
   if(t?.signature!==signature||t.verifiedOnChain!==true||t.transferVerified!==true||
      !validNetworkAddress(t.from)||!validNetworkAddress(t.to)||t.from===t.to||
      !Number.isSafeInteger(t.slot)||t.slot<0||!["SOL","SPL","TOKEN_2022"].includes(t.assetType)||
      typeof t.amountRaw!=="string"||!/^\d+$/.test(t.amountRaw)||BigInt(t.amountRaw)<=0n||
      (t.assetType!=="SOL"&&!validNetworkAddress(t.mint)))throw Error("NETWORK_MERGE_TRANSFER_INVALID");
  }
  additions.push({signature,transfers:ex.transfers});
 }
 if(Object.keys(source.processed).length+additions.length>NETWORK_RETENTION_LIMITS.signatures||
    source.transfers.length+additions.reduce((n,a)=>n+a.transfers.length,0)>NETWORK_RETENTION_LIMITS.transfers)
  throw Error("NETWORK_MERGE_RETENTION_LIMIT");
 const next=structuredClone(checkpoint),target=next.networkEvidence;
 for(const item of additions){
  target.processed[item.signature]={valid:true,unresolvedTokenTransfers:0,transferCount:item.transfers.length};
  target.transfers.push(...item.transfers);
 }
 return {checkpoint:next,addedSignatures:additions.map(x=>x.signature),
  addedTransfers:additions.reduce((n,a)=>n+a.transfers.length,0),
  requiresAtomicCommit:additions.length>0,scorePromoted:false};
}
