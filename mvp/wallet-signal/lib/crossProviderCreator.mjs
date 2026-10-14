import { createSolscanCreatorProvider } from "./solscanCreatorProvider.mjs";
import { fetchArchivedTransaction } from "./archiveTransaction.js";
import { verifyLaunchpadCreation } from "./launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "./pumpFunCreation.mjs";

const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const signature=/^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

/**
 * Read-only cross-provider corroboration.
 * Solscan Pro independently supplies a creator label and create_tx signature.
 * An optional separately operated archive RPC supplies the transaction bytes.
 * Provider label agreement alone NEVER counts as independent transaction decoding.
 */
export async function corroborateCreatorAcrossProviders({
 mint, heliusCreator, heliusSignature, solscanApiKey, archiveRpcUrl,
 solscanFetch=fetch, archiveFetch=fetch
}={}){
 if(!address.test(mint||"")||!address.test(heliusCreator||"")||!signature.test(heliusSignature||""))
  return {status:"INVALID_INPUT",comparisonStatus:"INSUFFICIENT_EVIDENCE",independentlyDecoded:false};
 if(!solscanApiKey)return {status:"SOLSCAN_NOT_CONFIGURED",comparisonStatus:"PROVIDER_UNAVAILABLE",independentlyDecoded:false};
 let records;
 try{records=await createSolscanCreatorProvider({apiKey:solscanApiKey,fetchImpl:solscanFetch}).lookup(mint);}
 catch(error){return {status:"SOLSCAN_UNAVAILABLE",comparisonStatus:"PROVIDER_UNAVAILABLE",reason:error?.message||"PROVIDER_ERROR",independentlyDecoded:false};}
 const record=records[0];
 if(!record)return {status:"SOLSCAN_NO_CREATOR_LABEL",comparisonStatus:"INSUFFICIENT_EVIDENCE",independentlyDecoded:false};
 const creatorMatches=record.creator===heliusCreator;
 const signatureMatches=record.creationSignature===heliusSignature;
 const base={solscanCreator:record.creator,solscanSignature:record.creationSignature,
  creatorMatches,signatureMatches,comparisonStatus:!creatorMatches || (record.creationSignature && !signatureMatches) ? "PROVIDER_DISAGREEMENT" : !record.creationSignature ? "INSUFFICIENT_EVIDENCE" : "PROVIDER_AGREEMENT",independentlyDecoded:false};
 if(!creatorMatches||(record.creationSignature&&!signatureMatches))
  return {...base,status:"PROVIDER_DISAGREEMENT"};
 if(!record.creationSignature)return {...base,status:"INSUFFICIENT_EVIDENCE"};
 if(!archiveRpcUrl)return {...base,status:"PROVIDER_LABELS_AGREE_TRANSACTION_NOT_INDEPENDENTLY_DECODED"};
 // Archive RPC must be independently operated; reject obvious Helius endpoint reuse.
 try{
  const archive=new URL(archiveRpcUrl);
  if(archive.protocol!=="https:"||/helius-rpc\.com$/i.test(archive.hostname))
   return {...base,status:"INDEPENDENT_ARCHIVE_REQUIRED"};
 }catch{return {...base,status:"INDEPENDENT_ARCHIVE_REQUIRED"};}
 const archived=await fetchArchivedTransaction(heliusSignature,{endpoint:archiveRpcUrl,fetchImpl:archiveFetch});
 if(archived.status!=="transaction_retrieved")
  return {...base,status:"INDEPENDENT_TRANSACTION_UNAVAILABLE",archiveStatus:archived.status};
 // Archive adapter returns raw JSON, whereas the current strict decoder expects parsed keys.
 // Do not claim independent decoding until a raw-message decoder is implemented and tested.
 return {...base,status:"INDEPENDENT_TRANSACTION_RETRIEVED_DECODING_PENDING",
  independentlyDecoded:false};
}
