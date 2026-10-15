// Read-only assessment diagnostic; does not create customer-facing final scores.
// Requires HELIUS_RPC_URL and TEST_TOKEN_MINT.
import {fetchMintHolderSnapshot} from '../lib/solanaHolderSnapshot.mjs';
import {assessHolderSnapshot} from '../lib/holderConcentrationAdapter.mjs';
const rpcUrl=process.env.HELIUS_RPC_URL,mint=process.env.TEST_TOKEN_MINT;
if(!rpcUrl || !mint) { console.error('Missing HELIUS_RPC_URL or TEST_TOKEN_MINT');process.exitCode=2; }
else {
 try {
  const snapshot=await fetchMintHolderSnapshot({rpcUrl,mint});
  const result=assessHolderSnapshot({snapshot,investigationComplete:false});
  console.log(JSON.stringify({
   mint,status:result.status,score:result.score,provisionalRange:result.provisionalRange,
   components:result.components,metrics:result.metrics,
   holderCount:snapshot.holders.length,snapshotSlot:snapshot.slot,
   supplySlot:snapshot.supplySlot,slotDelta:snapshot.slotDelta,
   supplyDefinition:snapshot.supplyDefinition,
   warning:'Diagnostic only. Wallet connection investigation, verified exclusions and circulating supply are not established.'
  }));
 }catch(error){
  console.error(JSON.stringify({status:'error',reason:String(error.message).replaceAll(rpcUrl,'[REDACTED]')}));
  process.exitCode=1;
 }
}
