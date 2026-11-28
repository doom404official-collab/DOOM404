import {PublicKey} from '@solana/web3.js';
const address=x=>{try{return typeof x==='string'&&new PublicKey(x).toBase58()===x;}catch{return false;}};
/** Index amounts/owners are discovery hints only. Every added account must be
 * independently re-read with the mint and owner controls before entering a score.
 * One bounded page is not a globally ordered holder ranking or complete inventory.
 * Primary contract: helius.dev/blog/how-to-get-token-holders-on-solana. */
export function normalizeHolderCandidatePage({mint,result,existing=[],maxCandidates=60}={}){
 if(!Number.isInteger(maxCandidates)||maxCandidates<20||maxCandidates>80)throw Error('INVALID_CANDIDATE_LIMIT');
 if(!address(mint)||!Array.isArray(existing)||existing.length>20||!existing.every(address))throw Error('INVALID_CANDIDATE_INPUT');
 if(!Array.isArray(result?.token_accounts)||result.token_accounts.length>60)throw Error('INVALID_HOLDER_INDEX_PAGE');
 const candidates=new Set(existing);
 for(const row of result.token_accounts){if(row?.mint!==mint||!address(row.address))throw Error('INVALID_HOLDER_INDEX_RECORD');if(candidates.size<maxCandidates)candidates.add(row.address);}
 return {addresses:[...candidates],indexedRecords:result.token_accounts.length,newCandidates:Math.max(0,candidates.size-new Set(existing).size),rankingComplete:false,inventoryComplete:false,status:'bounded_index_candidates',terminalReason:result.token_accounts.length===0?'index_page_empty':'one_page_candidate_budget',source:'helius_getTokenAccounts_one_page',scope:'At most one page / sixty distinct account candidates; index order and amounts are not used as current balance evidence.'};
}
export async function discoverHolderCandidates({mint,existing,lookupPage}={}){
 if(typeof lookupPage!=='function')throw Error('MISSING_HOLDER_INDEX');
 const result=await lookupPage({mint,page:1,limit:60,displayOptions:{}});
 return normalizeHolderCandidatePage({mint,result,existing});
}
