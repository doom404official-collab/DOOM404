// INACTIVE direct-TLS preparation. No environment, pooling, role fallback or retry.
import {Client} from 'pg';
import {X509Certificate} from 'node:crypto';
const host='db.acwmtobcbpkjfqiatyke.supabase.co';
const prefix='SELECT liquidity_fencing_private.';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const decimal=v=>typeof v==='string'&&/^[1-9][0-9]*$/.test(v)&&BigInt(v)<=9223372036854775807n;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const identity="SELECT json_build_object('session',session_user,'current',current_user) AS result";
const queries=new Map([
 [identity,{read:true,valid:v=>v.length===0}],
 [prefix+'read_manifest($1::uuid) AS result',{read:true,valid:v=>v.length===1&&uuid(v[0])}],
 [prefix+'read_accounting($1::uuid) AS result',{read:true,valid:v=>v.length===1&&uuid(v[0])}],
 [prefix+'read_receipt($1::uuid) AS result',{read:true,valid:v=>v.length===1&&uuid(v[0])}],
 [prefix+'claim($1::uuid,$2::text) AS result',{purpose:'executor',valid:v=>v.length===2&&uuid(v[0])&&digest(v[1])}],
 [prefix+'reserve($1::uuid,$2::bigint,$3::integer) AS result',{purpose:'executor',valid:v=>v.length===3&&uuid(v[0])&&decimal(v[1])&&Number.isSafeInteger(v[2])&&v[2]>0&&v[2]<=60}],
 [prefix+'stage($1::uuid,$2::bigint,$3::text,$4::text,$5::text) AS result',{purpose:'executor',valid:v=>v.length===5&&uuid(v[0])&&decimal(v[1])&&decimal(v[2])&&digest(v[3])&&['history_candidate','replay_diagnostic','stage1_observation'].includes(v[4])}],
 [prefix+'record_review($1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::text,$7::bigint,$8::integer,$9::text,$10::boolean,$11::boolean) AS result',{purpose:'reviewer',valid:v=>v.length===11&&uuid(v[0])&&uuid(v[1])&&decimal(v[2])&&digest(v[3])&&digest(v[4])&&typeof v[5]==='string'&&/^[a-f0-9]{40}$/.test(v[5])&&decimal(v[6])&&v[7]===1&&v[8]==='success'&&v[9]===true&&v[10]===true}],
 [prefix+'admit_accounted($1::uuid,$2::bigint,$3::text,$4::integer) AS result',{purpose:'reviewer',valid:v=>v.length===4&&uuid(v[0])&&decimal(v[1])&&digest(v[2])&&Number.isSafeInteger(v[3])&&v[3]>=0&&v[3]<=60}]
]);
export function createInactiveLiquidityPostgres(options={}){
 if(options.enabled!==true)throw Error('LIQUIDITY_PG_DISABLED');
 const {purpose,config,connectMs=2000,queryMs=5000}=options;
 const user=purpose==='executor'?'liquidity_fencing_executor':purpose==='reviewer'?'liquidity_fencing_reviewer':null;
 if(!user||!config||Object.keys(config).some(k=>!['host','port','database','user','password','ca'].includes(k)))throw Error('LIQUIDITY_PG_CONFIG');
 const c={...config};
 if(c.host!==host||c.port!==5432||c.database!=='postgres'||c.user!==user||typeof c.password!=='string'||!c.password||c.password.includes('\0')||typeof c.ca!=='string'||c.ca.length>32768||!c.ca.startsWith('-----BEGIN CERTIFICATE-----')||!Number.isSafeInteger(connectMs)||connectMs<1||connectMs>3000||!Number.isSafeInteger(queryMs)||queryMs<1||queryMs>10000)throw Error('LIQUIDITY_PG_CONFIG');
 try{new X509Certificate(c.ca);}catch{throw Error('LIQUIDITY_PG_CONFIG');}
 let busy=false;
 return Object.freeze({async query(request){
  const spec=queries.get(request?.text),signal=request?.signal;
  if(!spec||(!spec.read&&purpose!==spec.purpose)||!Array.isArray(request.values)||JSON.stringify(request.values).length>8192||!spec.valid(request.values)||(signal!==undefined&&!(signal instanceof AbortSignal)))throw Error('LIQUIDITY_PG_REQUEST');
  if(busy||signal?.aborted)throw Error('LIQUIDITY_PG_NOT_DISPATCHED');
  const text=request.text,values=[...request.values];busy=true;
  let client,dispatched=false,timer,end,closed=false;
  const close=()=>{
   if(closed)return;closed=true;
   try{client?.connection?.stream?.destroy();}catch{}
   try{void Promise.resolve(client?.end()).catch(()=>{});}catch{}
  };
  let cancel;const cancelled=new Promise((_,reject)=>{cancel=()=>{close();reject(Error('CANCELLED'));};});
  const arm=ms=>{clearTimeout(timer);end=performance.now()+ms;timer=setTimeout(cancel,ms);};
  const check=()=>{if(closed||signal?.aborted||performance.now()>=end)throw Error('DEADLINE');};
  try{
   client=new Client({host,port:5432,database:'postgres',user,password:c.password,
   ssl:{ca:c.ca,rejectUnauthorized:true,minVersion:'TLSv1.2',servername:host},sslnegotiation:'postgres',
   options:'-c search_path=pg_catalog -c row_security=on',client_encoding:'UTF8',replication:'false',
   application_name:'liquidity-inactive-fencing',fallback_application_name:'liquidity-inactive-fencing',
   connectionTimeoutMillis:connectMs,statement_timeout:queryMs,lock_timeout:queryMs,idle_in_transaction_session_timeout:queryMs,
   query_timeout:0,pipeline:false,keepAlive:false});
   client.on('error',()=>{});
   signal?.addEventListener('abort',cancel,{once:true});
   arm(connectMs);await Promise.race([client.connect(),cancelled]);check();
   arm(queryMs);
   const probe=await Promise.race([client.query("SELECT session_user AS s,current_user AS c,current_database() AS d,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls"),cancelled]);check();
   const row=probe.rows?.[0];if(probe.rows?.length!==1||row.s!==user||row.c!==user||row.d!=='postgres'||row.tls!==true)throw Error('IDENTITY');
   // pg does not honor query AbortSignal: race plus stream destruction is explicit.
   dispatched=true;const result=await Promise.race([client.query({text,values}),cancelled]);check();return result;
  }catch{throw Object.assign(Error(dispatched&&!spec.read?'LIQUIDITY_PG_OUTCOME_UNKNOWN':'LIQUIDITY_PG_NOT_CONFIRMED'),{reconciliationRequired:dispatched&&!spec.read,retries:0});}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);busy=false;close();}
 }});
}
