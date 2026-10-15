// Read-only RPC diagnostic. Run with HELIUS_RPC_URL and TEST_TOKEN_MINT.
// Never print credentials or the RPC URL.
import {fetchMintHolderSnapshot} from '../lib/solanaHolderSnapshot.mjs';
const mint=process.env.TEST_TOKEN_MINT;
const rpcUrl=process.env.HELIUS_RPC_URL;
if(!mint || !rpcUrl) {
 console.error('Missing TEST_TOKEN_MINT or HELIUS_RPC_URL');
 process.exitCode=2;
} else {
 try {
  const snapshot=await fetchMintHolderSnapshot({rpcUrl,mint});
  console.log(JSON.stringify({
   status:'ok',mint,slot:snapshot.slot,holderCount:snapshot.holders.length,
   totalSupply:snapshot.rawMintSupply,decimals:snapshot.decimals,
   supplyDefinition:snapshot.supplyDefinition,
   note:'RPC account coverage and supply interpretation require further independent validation'
  }));
 } catch(error) {
  console.error(JSON.stringify({status:'error',mint,reason:String(error.message).replaceAll(rpcUrl,'[REDACTED]')}));
  process.exitCode=1;
 }
}
