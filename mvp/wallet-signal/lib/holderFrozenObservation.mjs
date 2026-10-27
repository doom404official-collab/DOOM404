import {HOLDER_RETAIN19_POLICY as policy,assessApprovedHolderEligibleConcentration} from './holderEligibleViewPolicy.mjs';
// Independent stored observation. Never reads or associates historical jobs.
export function projectHolderFrozenObservation(snapshot){
 const observation=assessApprovedHolderEligibleConcentration(snapshot);
 return {mint:policy.mint,status:'observed_only',source:'stored_frozen_snapshot',snapshot:{
  id:snapshot.id,mint:snapshot.mint,slot:snapshot.slot,status:snapshot.status,supply_raw:snapshot.supply_raw,
  holder_ranking:snapshot.holder_ranking.map(h=>({wallet:h.wallet,balance:h.balance})),excluded_wallets:[...snapshot.excluded_wallets]},
  observation,jobAssociationVerified:false,snapshotProvenanceVerified:false,finalScore:null};
}
export async function readHolderFrozenObservation(mint,{url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl=fetch}={}){
 if(mint!==policy.mint)return {mint,status:'not_applicable',finalScore:null};
 if(!url||!key||!/^https:\/\//.test(url))throw Error('FROZEN_STORE_NOT_CONFIGURED');
 const response=await fetchImpl(url.replace(/\/$/,'')+'/rest/v1/glitch_top20_snapshots?select=id,mint,slot,status,supply_raw,holder_ranking,excluded_wallets&id=eq.'+policy.snapshotId+'&mint=eq.'+policy.mint+'&limit=2',{
  method:'GET',headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store',signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('FROZEN_STORE_UNAVAILABLE');
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length>1)throw Error('FROZEN_STORE_INVALID');
 if(!rows.length)return {mint,status:'unavailable',finalScore:null};
 return projectHolderFrozenObservation(rows[0]);
}
