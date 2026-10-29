// INACTIVE reviewer composition. Trusted session and artifact reader are separate
// from the executor. No caller-supplied accepted/authenticated flags or uploader.
import {createHash} from 'node:crypto';
import {createLiquidityHistoryDeadline} from '../../../lib/liquidityHistoryRuntime.mjs';
import {buildHistoricalReplayPlan} from '../../../lib/liquidityHistoricalReplayPlan.mjs';
import {assessAutomaticHistoryCheckpoint} from '../../../lib/liquidityAutomaticHistoryGate.mjs';
import {assessOfflineEvidencePreservation} from '../../../lib/liquidityAutoWorkerEvidenceGate.mjs';
import {describeLiquidityPublication} from './sidecars.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const decimal=v=>typeof v==='string'&&/^[1-9][0-9]*$/.test(v)&&BigInt(v)<=9223372036854775807n;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const reject=()=>{throw Error('LIQUIDITY_REVIEW_REJECTED');};
export async function reviewLiquidityArtifact(options={}){
 if(options.enabled!==true)return {status:'DISABLED',checkpointEligible:false};
 const {operation,reviewId,session,readArtifact,signal,maxBytes,now=Date.now}=options;
 if(!uuid(operation)||!uuid(reviewId)||!session||typeof session.query!=='function'||typeof readArtifact!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>16*1024*1024)reject();
 const execution=structuredClone(options.execution),source=Buffer.from(options.sourceBytes??[]);
 if(source.length>maxBytes)reject();
 const deadline=createLiquidityHistoryDeadline({durationMs:20000,signal,now});
 let phase='identity',uncertain=false,reviewRecorded=false,manifest;
 const check=()=>{deadline.check();if(manifest&&(now()<manifest.startsAt||now()>=manifest.expiresAt))reject();};
 const query=async(text,values,mutation=false)=>{check();if(mutation)uncertain=true;const r=await deadline.run(async(signal,verify)=>{const r=await session.query({text,values,signal});verify();check();return r;});if(r?.rows?.length!==1||!Object.hasOwn(r.rows[0],'result'))reject();return r.rows[0].result;};
 try{
  const identity=await query("SELECT json_build_object('session',session_user,'current',current_user) AS result",[]);
  if(identity?.session!=='liquidity_fencing_reviewer'||identity.current!==identity.session)reject();
  phase='manifest';manifest=await query('SELECT liquidity_fencing_private.read_manifest($1::uuid) AS result',[operation]);
  if(!manifest||manifest.operation!==operation||manifest.repository!=='doom404official-collab/DOOM404'||manifest.ref!=='refs/heads/fix/glitch-recovery-preflight-20261027'||manifest.purpose!=='history'||!decimal(manifest.run)||manifest.attempt!==1||typeof manifest.commit!=='string'||!/^[a-f0-9]{40}$/.test(manifest.commit)||!Number.isSafeInteger(manifest.startsAt)||!Number.isSafeInteger(manifest.expiresAt)||manifest.expiresAt<=manifest.startsAt||manifest.expiresAt-manifest.startsAt>480000||!Number.isSafeInteger(manifest.requestCeiling)||manifest.requestCeiling<1||manifest.requestCeiling>60||!execution||['repository','ref','commit','run','attempt'].some(k=>execution[k]!==manifest[k]))reject();
  check();if(hash(source)!==manifest.parentDigest)reject();
  const prior=JSON.parse(source.toString('utf8'));
  if(prior.pool!==manifest.pool||buildHistoricalReplayPlan(prior,{pool:manifest.pool,maxSignatures:1}).sourceDigest!==manifest.semanticSourceDigest||assessAutomaticHistoryCheckpoint(prior,manifest.pool).action!=='CONTINUE_BOUNDED')reject();
  phase='receipt';const receipt=await query('SELECT liquidity_fencing_private.read_receipt($1::uuid) AS result',[operation]);
  const a=receipt?.artifact,c=receipt?.claim;
  // Existing SQL JSON receipt has numeric bigint epochs: reject lossy values.
  const epoch=Number.isSafeInteger(c?.epoch)&&c.epoch>0?String(c.epoch):c?.epoch;
  if(receipt?.admission!==null||c?.operation!==operation||!decimal(epoch)||a?.operation!==operation||a.kind!=='history_candidate'||!decimal(a.artifact_id)||typeof a.digest!=='string'||!/^[a-f0-9]{64}$/.test(a.digest))reject();
  phase='readback';const response=await deadline.run(async(signal,verify)=>{const r=await readArtifact({artifactId:a.artifact_id,signal});verify();check();return r;});
  // The future authenticated GitHub adapter must normalize metadata independently
  // of executor receipts, enforce download limits before allocation and reject
  // ambiguous/duplicate run artifacts. Synthetic service only in current tests.
  if(!Array.isArray(response?.artifacts)||response.artifacts.length!==1)reject();
  const metadata=response.artifacts[0];
  if(!metadata||metadata.artifactId!==a.artifact_id||metadata.name!=='liquidity-quarantine-'+manifest.run||metadata.expired!==false||metadata.conclusion!=='success'||['repository','ref','commit','run','attempt'].some(k=>metadata[k]!==manifest[k])||!Array.isArray(response.files)||response.files.length!==1)reject();
  const files=response.files.map(f=>{if(!f||!Buffer.isBuffer(f.bytes)||f.bytes.length>maxBytes)reject();return {name:f.name,bytes:Buffer.from(f.bytes)};});
  const bundle=describeLiquidityPublication({run:manifest.run,conclusion:metadata.conclusion,files});
  if(bundle.status!=='REQUIRES_INDEPENDENT_REVIEW'||hash(files[0].bytes)!==a.digest)reject();
  const next=JSON.parse(files[0].bytes.toString('utf8'));
  const assessment=assessOfflineEvidencePreservation({prior,next,artifactName:'liquidity-history-'+manifest.run});
  if(!assessment.checkpointEligible)reject();
  if(prior.requestCount!==undefined&&(!Number.isSafeInteger(prior.requestCount)||!Number.isSafeInteger(next.requestCount)||next.requestCount<prior.requestCount||next.requestCount-prior.requestCount>manifest.requestCeiling))reject();
  check();phase='record_review';
  const recorded=await query('SELECT liquidity_fencing_private.record_review($1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::text,$7::bigint,$8::integer,$9::text,$10::boolean,$11::boolean) AS result',[operation,reviewId,a.artifact_id,a.digest,manifest.parentDigest,manifest.commit,manifest.run,1,'success',true,true],true);
  if(recorded!=='')reject();uncertain=false;reviewRecorded=true;
  phase='admit';const admitted=await query('SELECT liquidity_fencing_private.admit($1::uuid,$2::bigint,$3::text) AS result',[operation,epoch,manifest.parentDigest],true);
  if(admitted!==a.digest)reject();uncertain=false;
  // SQL admission is not canonical publication, archive coverage or score approval.
  return {status:'ADMITTED_RECEIPT',operation,reviewId,digest:admitted,canonicalPublished:false,checkpointEligible:false};
 }catch{return {status:uncertain||reviewRecorded?'RECONCILIATION_REQUIRED':'REVIEW_REJECTED',phase,operation,reconciliationRequired:uncertain||reviewRecorded,retries:0,checkpointEligible:false};}
}
