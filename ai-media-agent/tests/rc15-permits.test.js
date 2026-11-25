'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const env={VERCEL_ENV:'preview',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'unit-db-secret',OPENAI_EDITORIAL_API_KEY:'unit-permit-secret'};
const mint='EMQGeopasoZZUqiPDErvSL1QqvGr5WfZ1hbcvmAf8C3Y';
function req(body={},ip='192.0.2.1'){return {method:'POST',headers:{host:'fixture.vercel.app',origin:'https://fixture.vercel.app','content-type':'application/json','x-vercel-forwarded-for':ip},body};}
function res(){return {code:200,setHeader(){},status(n){this.code=n;return this},json(body){this.body=body;return this},end(){return this}};}
function setup({decision='ADMITTED',fault=false}={}){let clock=Date.now(),db=0,upstream=0;const consumed=new Set();class Clock extends Date{static now(){return clock;}}
 function load(file,modules={}){const ctx={module:{exports:{}},require:n=>modules[n]||require(require.resolve(n,{paths:[path.dirname(path.join(root,file))]})),process:{env},Date:Clock,Buffer,URL,AbortSignal,console,fetch:async()=>{db++;if(fault)throw Error('private database failure');return {ok:true,json:async()=>({status:decision})}}};vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);return ctx.module.exports;}
 const adapter=load('lib/durable-admission.js'),security=load('lib/research-security.js');
 const permits=load('lib/research-permit.js',{'./durable-admission':adapter,'./research-security':security});
 const admission={...adapter,admit:async(q,r,p,n,proof)=>{if(!await adapter.admit(q,r,p,n,proof))return false;const k=p+':'+n;if(consumed.has(k)){r.status(409).json({error:'ADMISSION_REPLAY'});return false;}consumed.add(k);return true;}};
 const issue=load('api/research-permit.js',{'../lib/durable-admission':admission,'../lib/research-security':security,'../lib/research-permit':permits});
 const investigate=load('api/investigate.js',{'../lib/durable-admission':admission,'../lib/research-security':security,'../lib/research-permit':permits,'./owners':async(q,r)=>{upstream++;r.status(503).json({});}});
 return {permits,issue,investigate,counts:()=>({db,upstream}),advance:n=>{clock+=n},clear:()=>consumed.clear(),fresh:()=>permits.issue(req(),mint),load};
}
const binding=p=>({mint,sessionId:p.sessionId});
test('server permit contains all fields and fixed five minute window',()=>{const h=setup(),p=h.fresh(),d=h.permits.verify(req(),p.researchPermit,binding(p));assert.equal(d.expiresAt-d.issuedAt,300000);assert.equal(d.purpose,'research');assert.ok(d.nonce!==d.sessionId);assert.match(d.clientBinding,/^[A-Za-z0-9_-]{43}$/);});
for(const mode of ['missing','modified','expired','mint','session','purpose','client','future','oversized','malformed'])test(mode+' permit fails before database and paid work',async()=>{const h=setup(),p=h.fresh(),b={mint,...p};delete b.expiresAt;
 if(mode==='missing')delete b.researchPermit;
 if(mode==='modified')b.researchPermit=b.researchPermit.replace(/^./,b.researchPermit[0]==='a'?'b':'a');
 if(mode==='expired')h.advance(300000);
 if(mode==='mint')b.mint='11111111111111111111111111111111';
 if(mode==='session')b.sessionId=crypto.randomUUID();
 if(mode==='purpose'){const security=h.load('lib/research-security.js');b.researchPermit=security.sign({mint,sessionId:p.sessionId,purpose:'narration'});}
 if(mode==='future')h.advance(-15001);
 if(mode==='oversized')b.researchPermit='x'.repeat(2500);
 if(mode==='malformed')b.researchPermit='a.b.c';
 const r=res();await h.investigate(req(b,mode==='client'?'192.0.2.2':'192.0.2.1'),r);assert.equal(r.code,403);assert.deepEqual(h.counts(),{db:0,upstream:0});});
test('valid permit admits once; reissue cannot bypass signed session replay',async()=>{const h=setup(),p=h.fresh(),r=res();await h.investigate(req({mint,sessionId:p.sessionId,researchPermit:p.researchPermit}),r);assert.equal(r.code,503);assert.equal(h.counts().upstream,1);
 h.advance(1000);const old=h.permits.verify(req(),p.researchPermit,binding(p)),p2=h.permits.issue(req(),mint,old);assert.equal(p.sessionId,p2.sessionId);assert.equal(p.expiresAt,p2.expiresAt);assert.notEqual(p.researchPermit,p2.researchPermit);
 const r2=res();await h.investigate(req({mint,sessionId:p2.sessionId,researchPermit:p2.researchPermit}),r2);assert.equal(r2.code,409);assert.equal(h.counts().upstream,1);
 h.advance(2*3600000);h.clear();assert.throws(()=>h.permits.verify(req(),p.researchPermit,binding(p)));const r3=res();await h.investigate(req({mint,sessionId:p.sessionId,researchPermit:p.researchPermit}),r3);assert.equal(r3.code,403);assert.equal(h.counts().upstream,1);
 const fresh=h.fresh();assert.notEqual(fresh.sessionId,p.sessionId);const r4=res();await h.investigate(req({mint,...binding(fresh),researchPermit:fresh.researchPermit}),r4);assert.equal(h.counts().upstream,2);
});
for(const [decision,code] of [['REPLAY',409],['RATE_LIMIT',429],['UNKNOWN',503]])test('permit issuance '+decision+' fails closed',async()=>{const h=setup({decision}),r=res();await h.issue(req({mint}),r);assert.equal(r.code,code);assert.equal(r.body.researchPermit,undefined);});
test('issuance database outage fails closed',async()=>{const h=setup({fault:true}),r=res();await h.issue(req({mint}),r);assert.equal(r.code,503);assert.equal(r.body.researchPermit,undefined);});
test('issuance forbids caller selected sessions and arbitrary fields',async()=>{const h=setup();for(const extra of [{sessionId:crypto.randomUUID()},{purpose:'narration'},{expiresAt:Infinity}]){const r=res();await h.issue(req({mint,...extra}),r);assert.equal(r.code,400);}assert.equal(h.counts().db,0);});
test('issuance reissue preserves window and refuses expired proof',async()=>{const h=setup(),r=res();await h.issue(req({mint}),r);assert.equal(r.code,200);h.advance(1000);const r2=res();await h.issue(req({mint,researchPermit:r.body.researchPermit}),r2);assert.equal(r2.code,200);assert.equal(r2.body.sessionId,r.body.sessionId);assert.equal(r2.body.expiresAt,r.body.expiresAt);h.advance(300000);const r3=res();await h.issue(req({mint,researchPermit:r.body.researchPermit}),r3);assert.equal(r3.code,403);assert.equal(h.counts().db,2);});
test('research signature cannot authorize narration',()=>{const h=setup(),p=h.fresh(),security=h.load('lib/research-security.js');assert.throws(()=>security.verify(p.researchPermit,{mint,sessionId:p.sessionId,purpose:'narration'}));});
test('IPv6 spelling changes preserve permit binding; spoofed secondary headers ignored',()=>{const h=setup(),q=req({},'2001:db8::1'),p=h.permits.issue(q,mint);const q2=req({},'2001:0db8:0:0:0:0:0:1');q2.headers['x-forwarded-for']='198.51.100.5';assert.ok(h.permits.verify(q2,p.researchPermit,binding(p)));});
test('missing or invalid trusted identity rejects permit',()=>{const h=setup(),p=h.fresh();for(const ip of ['',undefined,'fake','192.0.2.1,192.0.2.2']){const q=req();q.headers['x-vercel-forwarded-for']=ip;assert.throws(()=>h.permits.verify(q,p.researchPermit,binding(p)));}});

test("database expiry after permit verification prevents upstream work",async()=>{const h=setup({decision:"EXPIRED"}),p=h.fresh(),r=res();await h.investigate(req({mint,sessionId:p.sessionId,researchPermit:p.researchPermit}),r);assert.equal(r.code,403);assert.deepEqual(h.counts(),{db:1,upstream:0});});
