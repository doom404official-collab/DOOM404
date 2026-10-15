import {fetchMintHolderSnapshot} from '../lib/solanaHolderSnapshot.mjs';
import {freezeTop20Snapshot} from '../lib/frozenTop20Investigation.mjs';
import {createTop20Vault} from '../lib/top20Vault.mjs';
const env=process.env;
if(!env.HELIUS_RPC_URL||!env.TEST_TOKEN_MINT||!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY){
 console.error('Required configuration missing');process.exitCode=2;
}else{
 try{
  const raw=await fetchMintHolderSnapshot({rpcUrl:env.HELIUS_RPC_URL,mint:env.TEST_TOKEN_MINT});
  const frozen=freezeTop20Snapshot({mint:env.TEST_TOKEN_MINT,snapshot:raw});
  const vault=createTop20Vault({url:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
  await vault.saveFrozen(frozen);
  const stored=await vault.getFrozen(frozen.id);
  if(stored.id!==frozen.id||stored.snapshot_slot!==frozen.slot)throw new Error('Snapshot verification mismatch');
  console.log(JSON.stringify({status:'verified',snapshotId:frozen.id,slot:frozen.slot,
   holderCount:frozen.holders.length,supplyDefinition:raw.supplyDefinition,finalScore:false}));
 }catch(error){console.error('Top20 snapshot verification failed:',error?.name??'Error');process.exitCode=1;}
}
