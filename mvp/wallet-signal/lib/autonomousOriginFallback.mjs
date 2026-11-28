import {verifyBoundedCreatorOrigin} from './boundedCreatorOriginV2.mjs';
const status=e=>e?.code===-32601?'indexed_method_unsupported':e?.code===-32602?'indexed_request_rejected':e?.name==='TimeoutError'||e?.name==='AbortError'?'provider_timeout':e?.code==='PROVIDER_BUDGET'?'provider_quota_exhausted':'provider_unavailable';
/** Deterministic retrieval hierarchy. Every operation uses the caller's charged
 * read function; at most five origin reads, with no repeated signature fetch.
 * A newest-first standard signature window is never called earliest history. */
export async function recoverCreatorOriginCandidates({mint,read,alternateProvider=false}={}){
 const attempts=[],candidates=new Map();
 const merge=txs=>{for(const tx of txs){const sig=tx?.transaction?.signatures?.[0];if(typeof sig==='string')candidates.set(sig,tx);}};
 const options={transactionDetails:'full',sortOrder:'asc',limit:12,commitment:'finalized',encoding:'jsonParsed',maxSupportedTransactionVersion:1,filters:{status:'succeeded'}};
 for(const provider of alternateProvider?['primary','secondary']:['primary']){
  try{const page=await read('getTransactionsForAddress',[mint,options],provider);if(!Array.isArray(page?.data)||page.data.length>12)throw Error('invalid_page');merge(page.data);attempts.push({strategy:'ascending_mint_index',provider,status:'returned',candidates:page.data.length});
   if(page.data.some(tx=>verifyBoundedCreatorOrigin(tx,mint)))return {...page,originRetrieval:{attempts,terminalReason:'protocol_origin_receipt_recovered'}};
  }catch(e){if(e?.code==='PROVIDER_BUDGET'||e?.code==='REQUEST_DEADLINE')throw e;attempts.push({strategy:'ascending_mint_index',provider,status:status(e)});}
 }
 try{
  const rows=await read('getSignaturesForAddress',[mint,{limit:12,commitment:'finalized'}],'primary');
  if(!Array.isArray(rows)||rows.length>12)throw Error('invalid_signature_page');
  const selected=rows.filter(r=>r.err===null&&typeof r.signature==='string'&&Number.isSafeInteger(r.slot)&&!candidates.has(r.signature)).sort((a,b)=>a.slot-b.slot).slice(0,2);
  attempts.push({strategy:'bounded_standard_mint_signature_window',provider:'primary',status:'returned',signatures:rows.length,transactionFetches:selected.length,lifetimeWindowComplete:false});
  for(const r of selected){try{const tx=await read('getTransaction',[r.signature,{encoding:'jsonParsed',commitment:'finalized',maxSupportedTransactionVersion:1}],'primary');if(tx?.transaction?.signatures?.[0]===r.signature&&tx.meta?.err===null){const prior=[...candidates.values()];candidates.clear();merge([tx,...prior]);}}catch(e){if(e?.code==='PROVIDER_BUDGET'||e?.code==='REQUEST_DEADLINE')throw e;attempts.push({strategy:'standard_candidate_transaction',status:status(e)});}}
 }catch(e){if(e?.code==='PROVIDER_BUDGET'||e?.code==='REQUEST_DEADLINE')throw e;attempts.push({strategy:'bounded_standard_mint_signature_window',status:status(e)});}
 const data=[...candidates.values()].slice(0,12);
 return {data,paginationToken:null,originRetrieval:{attempts,terminalReason:data.some(tx=>verifyBoundedCreatorOrigin(tx,mint))?'protocol_origin_receipt_recovered':data.length?'supported_origin_not_established_in_bounded_candidates':'origin_retrieval_unavailable',historyComplete:false}};
}
