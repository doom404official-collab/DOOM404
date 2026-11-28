import {randomUUID} from 'node:crypto';
/** Server-only CAS lease; caches bounded observations without modifying historical checkpoints. */
export function createTokenInvestigationStore({env=process.env,fetchImpl=fetch}={}){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(env.SUPABASE_URL||'')||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('INVESTIGATION_STORE_UNAVAILABLE');
 const root=env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/';
 async function call(path,body,method){
  const r=await fetchImpl(root+path,{method:method||(body===undefined?'GET':'POST'),headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(4000),...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!r.ok)throw Error('INVESTIGATION_STORE_UNAVAILABLE');return r.status===204?null:r.json();
 }
 return {
  async read(mint){const rows=await call('scanner_token_investigations?mint=eq.'+mint+'&select=mint,status,observation,updated_at,lease_until,expires_at&limit=1');if(!Array.isArray(rows)||rows.length>1)throw Error('INVALID_INVESTIGATION_ROW');return rows[0]||null;},
  async expirePriorRevision(mint,previous,revision=9){
   // Expire only this exact completed old-algorithm snapshot. Preserve receipts
   // and the existing advisory-lock claim/lease; never modify a running worker.
   if(previous?.mint!==mint||previous.status!=='complete'||!Number.isFinite(Date.parse(previous.updated_at))||!Number.isInteger(revision)||![7,8,9].includes(revision)||Number.isInteger(previous.observation?.investigationRevision)&&previous.observation.investigationRevision>=revision)return false;
   await call('scanner_token_investigations?mint=eq.'+encodeURIComponent(mint)+'&status=eq.complete&updated_at=eq.'+encodeURIComponent(previous.updated_at),{expires_at:new Date(0).toISOString()},'PATCH');return true;
  },
  async claim(mint){const owner=randomUUID();const r=await call('rpc/scanner_claim_investigation_v1',{p_mint:mint,p_owner:owner});return {...r,owner};},
  async finish(mint,owner,observation){const r=await call('rpc/scanner_finish_investigation_v1',{p_mint:mint,p_owner:owner,p_observation:observation});if(r!==true)throw Error('INVESTIGATION_SAVE_UNCONFIRMED');}
 };
}
export function publicTokenObservation(observation){if(!observation||typeof observation!=='object')return observation;const {transactionCache,...visible}=observation;return visible;}
export function publicInvestigation(row,now=Date.now()){
 if(!row)return {status:'evidence_unavailable',reason:'bounded_investigation_not_started'};
 if(row.status==='running')return Date.parse(row.lease_until)>now?{status:'assessment_in_progress'}:{status:'evidence_unavailable',reason:'bounded_execution_interrupted'};
 if(Date.parse(row.expires_at)<=now)return {status:'evidence_unavailable',reason:'cached_observation_expired'};
 return publicTokenObservation(row.observation);
}
