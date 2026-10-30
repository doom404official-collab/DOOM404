import {HOLDER_RETAIN19_POLICY as policy,assessApprovedHolderEligibleConcentration} from './holderEligibleViewPolicy.mjs';
// Independent stored observation. Never reads or associates historical jobs.
export function projectHolderFrozenObservation(snapshot){
 const observation=assessApprovedHolderEligibleConcentration(snapshot);
 return {mint:policy.mint,status:'observed_only',source:'stored_frozen_snapshot',snapshot:{
  id:snapshot.id,mint:snapshot.mint,slot:snapshot.slot,status:snapshot.status,supply_raw:snapshot.supply_raw,...(snapshot.supply_definition?{supply_definition:snapshot.supply_definition}:{}),
  holder_ranking:snapshot.holder_ranking.map(h=>({wallet:h.wallet,balance:h.balance,...(Object.hasOwn(h,'rank')?{rank:h.rank}:{})})),excluded_wallets:[...snapshot.excluded_wallets]},
  observation,jobAssociationVerified:false,snapshotProvenanceVerified:false,finalScore:null};
}
export async function readHolderFrozenObservation(mint,{url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl=fetch}={}){
 if(mint!==policy.mint)return {mint,status:'not_applicable',finalScore:null};
 if(!url||!key||!/^https:\/\//.test(url))throw Error('FROZEN_STORE_NOT_CONFIGURED');
 const response=await fetchImpl(url.replace(/\/$/,'')+'/rest/v1/glitch_top20_snapshots?select=id,mint,snapshot_slot,status,supply_definition,supply_raw,holder_ranking,excluded_wallets&id=eq.'+policy.snapshotId+'&mint=eq.'+policy.mint+'&limit=2',{
  method:'GET',headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store',signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('FROZEN_STORE_UNAVAILABLE');
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length>1)throw Error('FROZEN_STORE_INVALID');
 if(!rows.length)return {mint,status:'unavailable',finalScore:null};
 const row=rows[0];
 // Hosted BIGINT arrives as a JSON number. Reject unsafe or coerced slots;
 // Raw supply stays a string; exact safe numeric balances are canonicalized below.
 if(!row||!Number.isSafeInteger(row.snapshot_slot)||row.snapshot_slot<0)throw Error('FROZEN_STORE_INVALID_SLOT');
 if(!Array.isArray(row.holder_ranking))throw Error('FROZEN_STORE_INVALID_RANKING');
 if(row.supply_definition!=='mint-total-supply-not-circulating')throw Error('FROZEN_STORE_INVALID_SUPPLY_DEFINITION');
 const ranking=row.holder_ranking.map((holder,index)=>{
  if(!holder||typeof holder!=='object'||Array.isArray(holder))throw Error('FROZEN_STORE_INVALID_HOLDER');
  const balance=holder.balance;
  if(typeof balance==='number'&&(!Number.isSafeInteger(balance)||balance<0))throw Error('FROZEN_STORE_INVALID_BALANCE');
  if(typeof balance!=='number'&&(typeof balance!=='string'||!/^\d+$/.test(balance)))throw Error('FROZEN_STORE_INVALID_BALANCE');
  if(Object.hasOwn(holder,'rank')&&holder.rank!==index+1)throw Error('FROZEN_STORE_INVALID_RANK');
  return {...holder,balance:typeof balance==='number'?String(balance):balance};
 });
 return projectHolderFrozenObservation({...row,slot:row.snapshot_slot,holder_ranking:ranking});
}
