import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import {PublicKey} from '@solana/web3.js';
import {withProviderUsage} from './providerUsage.mjs';
import {scannerContext,ScannerDenied,isScannerDenied} from './scannerRequestContext.mjs';
import {createScannerQuotaStore} from './scannerQuotaStore.mjs';
import {installScannerProviderGuard} from './scannerProviderGuard.mjs';
const PROJECT='prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e';
const wrappedUsage=new Set(['token-current','current-creator','current-liquidity','token-extensions','token-concentration','token-liquidity','creator']);
const workerRoutes=new Set(['holder-scan-worker','holder-scan-tick','holder-scan-scheduler','holder-scan-recovery','holder-evidence-tick']);
const internalRoutes=new Set(['holder-scan-start','holder-network-merge-controlled','internal/holder-scan-smoke']);
const probeRoutes=new Set(['liquidity-historical-rpc-probe','liquidity-archive-state-verify']);
const sha=x=>createHash('sha256').update(x).digest('hex');
const json=(body,status=200,retry)=>{const headers={'Cache-Control':'no-store','X-Glitch-Admission':'durable-v1'};if(retry)headers['Retry-After']=String(retry);return Response.json(body,{status,headers});};
function zeroUsage(response){for(const k of ['Rpc-Requests','Rpc-Calls','Market-Requests','Quote-Requests','Provider-Http-Requests'])response.headers.set('X-Glitch-'+k,'0');return response;}
function identityHeaders(response,env){for(const [key,value] of Object.entries({'X-Glitch-Commit':env.VERCEL_GIT_COMMIT_SHA,'X-Glitch-Deployment':env.VERCEL_DEPLOYMENT_ID,'X-Glitch-Project':env.VERCEL_PROJECT_ID,'X-Glitch-Branch':env.VERCEL_GIT_COMMIT_REF})){if(typeof value==='string'&&/^[A-Za-z0-9_./-]{1,120}$/.test(value))response.headers.set(key,value);}return response;}
export function scannerEnvironment(request,env){const host=new URL(request.url).hostname;return env.VERCEL_ENV==='production'||!/^doom404-wallet-signal-[a-z0-9]+-doom-404\.vercel\.app$/.test(host)?'production':'preview';}
function deny(error){const status=error.status||503,retryable=status===429||status>=500;return zeroUsage(json({error:error.code||'SCANNER_UNAVAILABLE',retryable},status,retryable?error.retryAfter||5:undefined));}
function normalizeIP(ip){
 if(isIP(ip)===4)return ip;
 if(isIP(ip)!==6)return null;
 const value=new URL('http://['+ip+']/').hostname.slice(1,-1);
 const [left,right='']=value.split('::'),a=left?left.split(':'):[],b=right?right.split(':'):[];
 const parts=[...a,...Array(8-a.length-b.length).fill('0'),...b].map(x=>x.padStart(4,'0'));
 // IPv4 mapped addresses use the same identity as their IPv4 spelling.
 if(parts.slice(0,5).every(x=>x==='0000')&&parts[5]==='ffff'){const n=parseInt(parts[6]+parts[7],16);return [n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.');}
 return parts.slice(0,4).join(':')+'::/64';
}
export function trustedScannerClient(request,env=process.env){
 if(env.VERCEL!=='1'||env.VERCEL_PROJECT_ID!==PROJECT||env.VERCEL_GIT_COMMIT_REF!=='integration/glitch-app-main-20261118'||!['preview','production'].includes(env.VERCEL_ENV)||!env.SUPABASE_SERVICE_ROLE_KEY)throw new ScannerDenied('TRUSTED_EDGE_UNAVAILABLE');
 // Vercel overwrites these at its edge. Never trust client IDs, cookies, query IDs or X-Real-IP.
 const ip=normalizeIP(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'');
 if(!ip)throw new ScannerDenied('TRUSTED_EDGE_UNAVAILABLE');
 return createHmac('sha256',env.SUPABASE_SERVICE_ROLE_KEY).update('doom404-scanner-client-v1:'+ip).digest('hex');
}
function authorized(request,route,env){
 let key,header;
 if(workerRoutes.has(route)){key='GLITCH_HOLDER_WORKER_TOKEN';header='x-glitch-worker-token';}
 else if(internalRoutes.has(route)||route==='holder-assessment'&&new URL(request.url).searchParams.has('jobId')){key='GLITCH_HOLDER_SCAN_INTERNAL_TOKEN';header='x-glitch-internal-token';}
 else if(probeRoutes.has(route)){key='GLITCH_LIQUIDITY_PROBE_TOKEN';header='x-glitch-internal-token';}
 if(!key)return true;
 const actual=request.headers.get(header)||'',expected=env[key]||'';
 return !!expected&&actual.length===expected.length&&timingSafeEqual(Buffer.from(actual),Buffer.from(expected));
}
async function inputKey(request,route,env){
 const url=new URL(request.url);
 if(request.method==='GET'){const required=['wallet','glitch','transactions','history'].includes(route)?['address']:route==='current-liquidity'?['mint','pool']:['mint'];if(required.some(k=>!url.searchParams.get(k)))throw new ScannerDenied('INVALID_ADDRESS',400);}
 for(const name of ['mint','address','wallet','pool','poolAddress']){
  const value=url.searchParams.get(name);if(value!==null){try{if(new PublicKey(value).toBase58()!==value)throw Error();}catch{throw new ScannerDenied('INVALID_ADDRESS',400);}}
 }
 if(url.search.length>4096)throw new ScannerDenied('INVALID_REQUEST',400);
 let body='';
 if(request.method==='POST'){
  const reader=request.clone().body?.getReader();const chunks=[];let size=0;
  if(reader){try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>32768)throw new ScannerDenied('REQUEST_TOO_LARGE',413);chunks.push(r.value);}}finally{reader.releaseLock();}}
  const bytes=Buffer.concat(chunks);try{body=JSON.stringify(JSON.parse(bytes.toString('utf8')));}catch{throw new ScannerDenied('INVALID_JSON',400);}
 }
 // Strip only Vercel access parameters. They cannot alter the selected operation or quota identity.
 for(const name of ['x-vercel-protection-bypass','x-vercel-set-bypass-cookie','_vercel_share'])url.searchParams.delete(name);
 url.searchParams.sort();
 return sha(JSON.stringify([env.VERCEL_GIT_COMMIT_SHA,route,request.method,url.search,body]));
}
async function cacheBody(response){
 if(response.status<200||response.status>=300||!response.headers.get('content-type')?.includes('application/json'))return null;
 const reader=response.clone().body.getReader();const parts=[];let size=0;
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>262144){reader.cancel().catch(()=>{});return null;}parts.push(r.value);}const data=JSON.parse(Buffer.concat(parts).toString());if(data?.error||['unavailable','current_wallet_unavailable','capacity_limited'].includes(data?.status))return null;return data;}catch{return null;}finally{reader.releaseLock();}
}
export function makeScannerAdmission({env=process.env,store,identify=trustedScannerClient,reportUsage=withProviderUsage}={}){
 return async function run(request,handler,route){
  let admission,ctx,timer;
  const db=store||createScannerQuotaStore({env});
  try{
   if(!authorized(request,route,env))return identityHeaders(zeroUsage(json({error:'Unauthorized'},401)),env);
   let inputTimer;const key=await Promise.race([inputKey(request,route,env),new Promise((_,reject)=>{inputTimer=setTimeout(()=>reject(new ScannerDenied('INPUT_DEADLINE',400)),2000)})]).finally(()=>clearTimeout(inputTimer));const client=identify(request,env),id=randomUUID();
   admission=await db.admit({p_client:client,p_key:key,p_route:route,p_id:id,p_environment:scannerEnvironment(request,env),p_sha:env.VERCEL_GIT_COMMIT_SHA,p_deployment:env.VERCEL_DEPLOYMENT_ID});
   if(admission.status==='CACHED'){const response=zeroUsage(json(admission.body,admission.httpStatus));response.headers.set('X-Glitch-Admission-Cache','HIT');return identityHeaders(response,env);}
   if(admission.status!=='ADMITTED')throw new ScannerDenied(admission.status||'QUOTA_STORE_UNAVAILABLE',['RATE_LIMIT','DUPLICATE','CONCURRENT_LIMIT'].includes(admission.status)?429:admission.status==='RELEASE_NOT_AUTHORIZED'?403:503,admission.retryAfter||5);
   if(admission.lease!==id||!Number.isInteger(admission.deadlineMs)||admission.deadlineMs<1||admission.deadlineMs>60000)throw new ScannerDenied('QUOTA_STORE_UNAVAILABLE');
   ctx={store:db,lease:id,controller:new AbortController(),closed:false,denial:null};
   const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new ScannerDenied('REQUEST_DEADLINE');ctx.denial=error;ctx.closed=true;ctx.controller.abort(error);reject(error);},admission.deadlineMs);});
   const task=scannerContext.run(ctx,()=>wrappedUsage.has(route)?handler(request):reportUsage(handler,request));
   const response=await Promise.race([task,deadline]);
   if(ctx.denial)throw ctx.denial;
   clearTimeout(timer);ctx.closed=true;ctx.controller.abort();
   const body=request.method==='GET'?await cacheBody(response):null;
   await db.finish({p_id:id,p_body:body,p_status:response.status});
   admission=null;response.headers.set('X-Glitch-Admission','durable-v1');return identityHeaders(response,env);
  }catch(error){
   if(ctx){ctx.closed=true;ctx.controller.abort();}clearTimeout(timer);
   if(admission?.lease){try{await db.finish({p_id:admission.lease,p_body:null,p_status:503});}catch{}}
   const response=deny(isScannerDenied(error)?error:new ScannerDenied('SCANNER_UNAVAILABLE'));if(ctx?.attempts){for(const [name,value] of Object.entries({'Rpc-Requests':ctx.attempts.rpcHttp,'Rpc-Calls':ctx.attempts.rpcCalls,'Market-Requests':ctx.attempts.market,'Quote-Requests':ctx.attempts.quotes,'Provider-Http-Requests':ctx.attempts.other}))response.headers.set('X-Glitch-'+name,String(value));}return identityHeaders(response,env);
  }
 };
}
installScannerProviderGuard();
export const withScannerAdmission=makeScannerAdmission();
