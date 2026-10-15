import {fetchMintHolderSnapshot} from '../lib/solanaHolderSnapshot.mjs';
import {freezeTop20Snapshot} from '../lib/frozenTop20Investigation.mjs';
import {createTop20Vault} from '../lib/top20Vault.mjs';
const env=process.env;
if(!env.HELIUS_RPC_URL||!env.TEST_TOKEN_MINT||!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY){
 console.error('Required configuration missing');process.exitCode=2;
}else{
 let stage='initializing';
 try{
  stage='fetch_holder_snapshot';
  const expectedHost='acwmtobcbpkjfqiatyke.supabase.co';
  const actualHost=new URL(env.SUPABASE_URL).hostname;
  if(actualHost!==expectedHost)throw new Error('SUPABASE_PROJECT_MISMATCH');
  if(new URL(env.SUPABASE_URL).pathname!=='/')throw new Error('SUPABASE_URL_HAS_PATH');
  const raw=await fetchMintHolderSnapshot({rpcUrl:env.HELIUS_RPC_URL,mint:env.TEST_TOKEN_MINT});
  stage='freeze_top20';
  const frozen=freezeTop20Snapshot({mint:env.TEST_TOKEN_MINT,snapshot:raw});
  const vault=createTop20Vault({url:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
  stage='save_frozen_snapshot';
  await vault.saveFrozen(frozen);
  stage='read_back_snapshot';
  const stored=await vault.getFrozen(frozen.id);
  if(stored.id!==frozen.id||stored.snapshot_slot!==frozen.slot)throw new Error('Snapshot verification mismatch');
  console.log(JSON.stringify({status:'verified',snapshotId:frozen.id,slot:frozen.slot,
   holderCount:frozen.holders.length,supplyDefinition:raw.supplyDefinition,finalScore:false}));
 }catch(error){
  const message=String(error?.message??'');
  const code=/^VAULT_[A-Z0-9_]+_HTTP_[0-9]{3}(?:_PGRST[0-9]{3}|_UNKNOWN)?$/.test(message)?message:
   /SUPABASE_URL_HAS_PATH/.test(message)?'SUPABASE_URL_HAS_PATH':
   /Token account totals do not match/.test(message)?'SUPPLY_RECONCILIATION':
   /slots too far apart/.test(message)?'SLOT_MISMATCH':
   /Read-after-write verification mismatch|Frozen snapshot persistence mismatch/.test(message)?'READBACK_MISMATCH':
   /SUPABASE_PROJECT_MISMATCH/.test(message)?'SUPABASE_PROJECT_MISMATCH':
   /fetch failed|network|ECONN|ETIMEDOUT/i.test(message)?'NETWORK_ERROR':'UNCLASSIFIED_ERROR';
  console.error(JSON.stringify({status:'error',stage,code}));process.exitCode=1;
 }
}
