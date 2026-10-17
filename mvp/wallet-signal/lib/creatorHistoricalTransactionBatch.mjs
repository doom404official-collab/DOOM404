import { observeCreatorTransaction } from './creatorTransactionEvidence.mjs';
/** Decode a bounded batch of discovered signatures. Failed fetches stay pending.
 * This does not claim swap verification or archival completeness.
 */
export async function inspectCreatorHistoricalBatch({mint,creator,signatures=[],rpc,maxTransactions=20}={}){
 if(typeof rpc?.fetchTransaction!=='function'||!Array.isArray(signatures)||!Number.isInteger(maxTransactions)||maxTransactions<1||maxTransactions>100)throw Error('INVALID_CREATOR_BATCH');
 const observations=[],processed=[],pending=[];
 for(const signature of [...new Set(signatures)].slice(0,maxTransactions)){
  try{
   const tx=await rpc.fetchTransaction(signature);
   if(!tx){pending.push(signature);continue;}
   observations.push(observeCreatorTransaction({signature,transaction:tx,creator,mint}));
   processed.push(signature);
  }catch(error){
   if(['CREATOR_REQUEST_BUDGET_EXHAUSTED','RPC_REQUEST_BUDGET_EXHAUSTED'].includes(error?.message)){pending.push(signature);break;}
   pending.push(signature);
  }
 }
 return {observations,processed,pending,verifiedSales:[],historicalCoverageComplete:false};
}
