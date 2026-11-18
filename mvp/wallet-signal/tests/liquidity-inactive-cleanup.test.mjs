// Dependency fault injection only: real TLS/SCRAM stays in the disposable suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../docs/proposals/liquidity-inactive/postgres.mjs',import.meta.url),'utf8');
const fixture=source.replace("import {Client} from 'pg';",'const Client=globalThis.__liquidityFaultClient;').replace("import {X509Certificate} from 'node:crypto';",'class X509Certificate {}');
let mode='',constructs=0,ends=0,destroys=0;
class FaultClient{
 constructor(){constructs++;if(mode==='constructor'){mode='';throw Error('SYNTHETIC_SECRET');}this.connection={stream:{destroy(){destroys++;if(mode==='destroy')throw Error('SYNTHETIC_SECRET');}}};}
 on(){if(mode==='listener'){mode='';throw Error('SYNTHETIC_SECRET');}}
 async connect(){if(mode==='connect'){mode='';throw Error('SYNTHETIC_SECRET');}}
 async query(q){return typeof q==='string'?{rows:[{s:'liquidity_fencing_executor',c:'liquidity_fencing_executor',d:'postgres',tls:true}]}:{rows:[{result:{synthetic:true}}]};}
 end(){ends++;if(mode==='end')throw Error('SYNTHETIC_SECRET');if(mode==='end-reject')return Promise.reject(Error('SYNTHETIC_SECRET'));return Promise.resolve();}
}
globalThis.__liquidityFaultClient=FaultClient;
const {createInactiveLiquidityPostgres:create}=await import('data:text/javascript;base64,'+Buffer.from(fixture).toString('base64'));
delete globalThis.__liquidityFaultClient;
const config={host:'db.acwmtobcbpkjfqiatyke.supabase.co',port:5432,database:'postgres',user:'liquidity_fencing_executor',password:'synthetic',ca:'-----BEGIN CERTIFICATE-----synthetic'};
const request={text:'SELECT liquidity_fencing_private.read_manifest($1::uuid) AS result',values:['11111111-1111-4111-8111-111111111111']};
test('constructor and early listener/connect failures redact and release busy guard',async()=>{
 for(const fault of ['constructor','listener','connect']){
  mode=fault;constructs=ends=destroys=0;const transport=create({enabled:true,purpose:'executor',config});
  await assert.rejects(transport.query(request),e=>e.message==='LIQUIDITY_PG_NOT_CONFIRMED'&&!e.reconciliationRequired);
  assert.equal(constructs,1);const r=await transport.query(request);assert.equal(r.rows[0].result.synthetic,true);assert.equal(constructs,2);
  assert.equal(ends,fault==='constructor'?1:2);assert.equal(destroys,ends);
 }
});
test('throwing/rejected cleanup never leaks errors, wedges busy or causes retries',async()=>{
 for(const fault of ['destroy','end','end-reject']){
  mode=fault;constructs=ends=destroys=0;const transport=create({enabled:true,purpose:'executor',config});
  assert.equal((await transport.query(request)).rows[0].result.synthetic,true);await new Promise(r=>setImmediate(r));
  assert.equal(constructs,1);assert.equal(ends,1);assert.equal(destroys,1);
  mode='';await transport.query(request);assert.equal(constructs,2);
 }
});
