import {createTop20Vault} from '../lib/top20Vault.mjs';
import {consolidateTop20} from '../lib/consolidateTop20.mjs';
const {TOP20_SNAPSHOT_ID:id,SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key}=process.env;
if(!id||!url||!key){console.error('Missing required configuration');process.exitCode=2;}
else try{
 const vault=createTop20Vault({url,serviceRoleKey:key});
 const [snapshot,batches]=await Promise.all([vault.getFrozen(id),vault.getBatches(id)]);
 const result=consolidateTop20({snapshot,batches});
 console.log(JSON.stringify(result));
}catch(error){
 console.error(JSON.stringify({status:'error',category:error?.name??'Error',code:'TOP20_CONSOLIDATION_FAILED'}));
 process.exitCode=1;
}
