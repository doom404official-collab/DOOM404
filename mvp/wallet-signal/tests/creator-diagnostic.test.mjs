import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = (await readFile(new URL('../scripts/diagnose-test-mint-origin.mjs', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
const expected = '6RKsroTt2NgJvyUyhUcKqANrphWDw6eE52X9TMBsQ7WC';
async function run({matchAt, conflict = false, fail = false, missing = false} = {}) {
 const output = []; let requests = 0, page = 0, budget;
 const process = {env: missing ? {} : {HELIUS_RPC_URL: 'https://example.invalid'}, exitCode: 0, exit(code) { this.exitCode = code; throw Error('EXIT'); }};
 const context = vm.createContext({process, console: {log: text => output.push(JSON.parse(text))}, pumpFunDecoders: {},
  createSolanaRpcAdapter(config) {budget = config.maxRequests; return {
   async lookupSignaturePage() { if(++requests > budget) throw Error('RPC_REQUEST_BUDGET_EXHAUSTED'); page++; return {entries: Array.from({length:5},(_,i)=>({signature:`p${page}-${i}`})),nextCursor:`p${page}`,exhausted:false}; },
   async fetchTransaction(signature) { if(++requests > budget) throw Error('RPC_REQUEST_BUDGET_EXHAUSTED'); if(fail) throw Error('RPC_AUTH_FAILED'); return {signature}; }
  }; },
  verifyLaunchpadCreation({signature}) { return signature === matchAt ? {status:'VERIFIED',decodedRoles:[{role:'launchpad_creator',address:conflict?'different':expected,programId:'pump',decoderVersion:'test'}]} : {status:'UNRESOLVED'}; }
 });
 try { await new vm.Script(`(async () => {${source}\n})()`).runInContext(context); } catch(e) { if(e.message !== 'EXIT') throw e; }
 return {result:output.at(-1),exitCode:process.exitCode,requests,budget};
}
test('late creation match survives all five pages and retains independent review gate', async()=>{
 const r=await run({matchAt:'p5-0'}); assert.equal(r.requests,30); assert.equal(r.budget,60); assert.equal(r.exitCode,0); assert.equal(r.result.status,'ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW'); assert.equal(r.result.pagesFetched,5); assert.equal(r.result.transactionsChecked,25);
});
test('unresolved history returns nonzero workflow status',async()=>{const r=await run(); assert.equal(r.exitCode,2); assert.equal(r.result.status,'UNRESOLVED'); assert.equal(r.result.writeAttempted,false);});
test('creator conflict returns nonzero workflow status',async()=>{const r=await run({matchAt:'p1-4',conflict:true}); assert.equal(r.exitCode,1); assert.equal(r.result.status,'CREATOR_CONFLICT');});
test('provider error is sanitized and fails diagnostic',async()=>{const r=await run({fail:true}); assert.equal(r.exitCode,2); assert.equal(r.result.reason,'RPC_AUTH_FAILED');});
test('missing RPC fails rather than passing unexecuted diagnostic',async()=>{const r=await run({missing:true}); assert.equal(r.exitCode,2); assert.equal(r.result.status,'NOT_RUN');});
