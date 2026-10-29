import {Client} from 'pg';
import {X509Certificate} from 'node:crypto';
const roles={issuer:'relay_reserve',consumer:'relay_consume',verifier:'relay_readback',configuration:'relay_runtime_configuration',authAttempt:'relay_auth_attempt',seal:'relay_session_binding'};
const reject=()=>{throw Error('CREATOR_PG_CONFIGURATION_REJECTED');};
/** One connection / one parameterized operation. No environment, pool or retry API.
 * Connection loss after dispatch is uncertain, even when the server may roll back.
 */
export function createCreatorEvidencePostgres({enabled=false,config,purpose,connectMs=2000,queryMs=5000}={}){
 if(enabled!==true)throw Error('CREATOR_PG_DISABLED');
 if(!Object.hasOwn(roles,purpose)||!config||Object.keys(config).some(k=>!['host','port','database','user','password','ca'].includes(k)))reject();
 const c={...config};
 for(const k of ['host','database','user','password','ca'])if(typeof c[k]!=='string'||!c[k]||c[k].includes('\0'))reject();
 if(!/^[a-zA-Z0-9.-]+$/.test(c.host)||!Number.isSafeInteger(c.port)||c.port<1||c.port>65535||!Number.isSafeInteger(connectMs)||connectMs<1||connectMs>3000||!Number.isSafeInteger(queryMs)||queryMs<1||queryMs>10000)reject();
 if(!c.ca.startsWith('-----BEGIN CERTIFICATE-----')||c.ca.length>32768)reject();
 try{new X509Certificate(c.ca);}catch{reject();}
 const text=`SELECT creator_relay_test_private.${roles[purpose]}($1::jsonb${purpose==='verifier'?',$2::bigint':''}) AS result`;
 let busy=false;
 return Object.freeze({async query(request){
  if(busy)throw Error('CREATOR_PG_BUSY');
  if(request?.text!==text||!Array.isArray(request.values)||request.values.length!==(purpose==='verifier'?2:1)||typeof request.values[0]!=='string'||Buffer.byteLength(request.values[0])>8192||(purpose==='verifier'&&(!Number.isSafeInteger(request.values[1])||request.values[1]<=0)))throw Error('CREATOR_PG_REQUEST_REJECTED');
  const values=[...request.values],signal=request.signal;
  if(signal!==undefined&&!(signal instanceof AbortSignal))throw Error('CREATOR_PG_REQUEST_REJECTED');
  if(signal?.aborted)throw Error('CREATOR_PG_NOT_DISPATCHED');
  busy=true;let dispatched=false,timer,closed=false,deadline;
  // Explicit identity/TLS/options prevent ambient connection strings, pgpass,
  // PGSSLMODE or PGOPTIONS from changing the approved connection.
  const client=new Client({host:c.host,port:c.port,database:c.database,user:c.user,password:c.password,
   ssl:{ca:c.ca,rejectUnauthorized:true,minVersion:'TLSv1.2',servername:c.host},sslnegotiation:'postgres',
   options:'-c search_path=pg_catalog -c row_security=on',client_encoding:'UTF8',replication:'false',
   application_name:'creator-evidence-test',fallback_application_name:'creator-evidence-test',
   connectionTimeoutMillis:connectMs,statement_timeout:queryMs,lock_timeout:queryMs,idle_in_transaction_session_timeout:queryMs,
   query_timeout:0,pipeline:false,keepAlive:false});
  client.on('error',()=>{}); // Transport details may contain credentials; never surface.
  const close=()=>{if(closed)return;closed=true;client.connection.stream.destroy();void client.end().catch(()=>{});};
  let cancel;
  const cancelled=new Promise((_,fail)=>{cancel=()=>{close();fail(Error('CANCELLED'));};});
  const arm=ms=>{clearTimeout(timer);deadline=performance.now()+ms;timer=setTimeout(cancel,ms);};
  signal?.addEventListener('abort',cancel,{once:true});
  try{
   arm(connectMs);
   await Promise.race([client.connect(),cancelled]);
   if(signal?.aborted||closed||performance.now()>=deadline)throw Error();
   arm(queryMs);dispatched=true;
   const result=await Promise.race([client.query({text,values}),cancelled]);
   if(signal?.aborted||closed||performance.now()>=deadline)throw Error();
   return result;
  }catch{throw Error(dispatched?'CREATOR_PG_OUTCOME_UNKNOWN':'CREATOR_PG_NOT_DISPATCHED');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);close();busy=false;}
 }});
}
