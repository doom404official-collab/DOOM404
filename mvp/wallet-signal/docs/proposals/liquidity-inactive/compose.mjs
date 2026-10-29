// INACTIVE PREPARATION ONLY. No environment, driver, credentials or workflow caller.
// The supplied session/publisher/cycle are trusted server adapters, not HTTP inputs.
import {createHash} from 'node:crypto';
import {createLiquidityHistoryDeadline} from '../../../lib/liquidityHistoryRuntime.mjs';
import {assessAutomaticHistoryCheckpoint} from '../../../lib/liquidityAutomaticHistoryGate.mjs';
import {buildHistoricalReplayPlan} from '../../../lib/liquidityHistoricalReplayPlan.mjs';
import {assessOfflineEvidencePreservation} from '../../../lib/liquidityAutoWorkerEvidenceGate.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const decimal=v=>typeof v==='string'&&/^[1-9][0-9]*$/.test(v)&&BigInt(v)<=9223372036854775807n;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const reject=()=>{throw Error('LIQUIDITY_INACTIVE_BINDING_REJECTED');};
export async function composeLiquidityQuarantine(options={}){
 // Check before reading any dependency/configuration getter.
 if(options.enabled!==true)return {status:'DISABLED',checkpointEligible:false};
 const {session,cycle,publish,signal,now=Date.now}=options;
 const b=structuredClone(options.binding),source=Buffer.from(options.sourceBytes??[]);
 if(!b||b.repository!=='doom404official-collab/DOOM404'||b.ref!=='refs/heads/fix/glitch-recovery-preflight-20261027'||
  !/^[a-f0-9]{40}$/.test(b.commit??'')||!decimal(b.run)||b.attempt!==1||b.purpose!=='history'||
  !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(b.operation??'')||
  !digest(b.parentDigest)||!digest(b.semanticSourceDigest)||hash(source)!==b.parentDigest||
  !Number.isSafeInteger(b.startsAt)||!Number.isSafeInteger(b.expiresAt)||b.startsAt>now()||b.expiresAt<=now()||
  b.expiresAt-b.startsAt>480000||b.expiresAt<=b.startsAt||!Number.isSafeInteger(b.requestCeiling)||b.requestCeiling<1||b.requestCeiling>60||
  !session||typeof session.query!=='function'||typeof cycle!=='function'||typeof publish!=='function')reject();
 const execution=structuredClone(options.execution);
 if(!execution||['repository','ref','commit','run','attempt'].some(k=>execution[k]!==b[k]))reject();
 const prior=JSON.parse(source.toString('utf8'));
 if(prior.pool!==b.pool||buildHistoricalReplayPlan(prior,{pool:b.pool,maxSignatures:1}).sourceDigest!==b.semanticSourceDigest||assessAutomaticHistoryCheckpoint(prior,b.pool).action!=='CONTINUE_BOUNDED')reject();
 const deadline=createLiquidityHistoryDeadline({durationMs:b.expiresAt-now(),signal,now});
 let phase='identity',uncertain=false,requests=0,epoch=null,busy=false,closed=false;
 const check=()=>{deadline.check();if(now()<b.startsAt||now()>=b.expiresAt||closed)throw Error('LIQUIDITY_INACTIVE_CLOSED');};
 const query=async(text,values,mutation=false)=>{
  check();if(mutation)uncertain=true;
  const r=await deadline.run(async(signal,verify)=>{const result=await session.query({text,values,signal});verify();check();return result;});
  if(!r||r.rows?.length!==1||!Object.hasOwn(r.rows[0],'result'))throw Error('LIQUIDITY_INACTIVE_RESPONSE');
  return r.rows[0].result;
 };
 try{
  // No SET ROLE or service-role fallback. Hosted identity is not inferred from mocks.
  const identity=await query('SELECT json_build_object(\'session\',session_user,\'current\',current_user) AS result',[]);
  if(identity.session!=='liquidity_fencing_executor'||identity.current!==identity.session)reject();
  phase='manifest';const installed=await query('SELECT liquidity_fencing_private.read_manifest($1::uuid) AS result',[b.operation]);
  if(!installed||['operation','repository','ref','commit','run','attempt','purpose','pool','parentDigest','semanticSourceDigest','requestCeiling','startsAt','expiresAt'].some(k=>installed[k]!==b[k]))reject();
  phase='claim';epoch=await query('SELECT liquidity_fencing_private.claim($1::uuid,$2::text) AS result',[b.operation,b.parentDigest],true);
  if(!decimal(epoch))throw Error('LIQUIDITY_INACTIVE_EPOCH');uncertain=false;
  const request=async operation=>{
   if(busy||closed||typeof operation!=='function'||requests>=b.requestCeiling){closed=true;throw Error('LIQUIDITY_INACTIVE_REQUEST_REJECTED');}
   busy=true;
   try{
    phase='reserve';const ordinal=requests+1;
    const reserved=await query('SELECT liquidity_fencing_private.reserve($1::uuid,$2::bigint,$3::integer) AS result',[b.operation,epoch,ordinal],true);
    if(reserved!==ordinal)throw Error('LIQUIDITY_INACTIVE_RESERVATION');uncertain=false;requests=ordinal;
    phase='lookup';return await deadline.run(async(signal,verify)=>{check();const result=await operation(signal);verify();check();return result;});
   }catch(error){closed=true;throw error;}finally{busy=false;}
  };
  phase='cycle';const next=await deadline.run(async()=>cycle({source:structuredClone(prior),request}));
  check();if(busy)throw Error('LIQUIDITY_INACTIVE_UNAWAITED_REQUEST');
  phase='validate';
  if(prior.requestCount!==undefined&&next?.requestCount!==prior.requestCount+requests)throw Error('LIQUIDITY_INACTIVE_ACCOUNTING');
  const name='liquidity-history-'+b.run;
  const assessment=assessOfflineEvidencePreservation({prior,next,artifactName:name});
  const bytes=Buffer.from(JSON.stringify(next)),candidateDigest=hash(bytes);check();
  // Existing CLIs still own incremental diagnostics. This final publication is
  // immutable and quarantined; failed/partial output never calls stage/admit.
  const partial=!assessment.checkpointEligible;
  phase='publish';uncertain=true;
  const receipt=await deadline.run(async(signal,verify)=>{const r=await publish({name:partial?'liquidity-history-partial-'+b.run:name,bytes:Buffer.from(bytes),digest:candidateDigest,signal});verify();check();return r;});
  if(!receipt||!decimal(receipt.artifactId)||receipt.digest!==candidateDigest||receipt.name!==(partial?'liquidity-history-partial-'+b.run:name))throw Error('LIQUIDITY_INACTIVE_PUBLICATION');
  uncertain=false;
  if(partial)return {status:'PARTIAL_QUARANTINED',artifactId:receipt.artifactId,digest:candidateDigest,requests,checkpointEligible:false};
  phase='stage';const staged=await query('SELECT liquidity_fencing_private.stage($1::uuid,$2::bigint,$3::text,$4::text,$5::text) AS result',[b.operation,epoch,receipt.artifactId,candidateDigest,'history_candidate'],true);
  // PostgreSQL void is serialized as the empty string by node-postgres.
  if(staged!=='')throw Error('LIQUIDITY_INACTIVE_STAGE_RESPONSE');uncertain=false;
  return {status:'STAGED_QUARANTINED',operation:b.operation,epoch,requests,artifactId:receipt.artifactId,digest:candidateDigest,checkpointEligible:false};
 }catch{
  return {status:uncertain?'RECONCILIATION_REQUIRED':'STOPPED_QUARANTINED',phase,operation:b.operation,epoch,requests,reconciliationRequired:uncertain,retries:0,checkpointEligible:false};
 }finally{closed=true;}
}
