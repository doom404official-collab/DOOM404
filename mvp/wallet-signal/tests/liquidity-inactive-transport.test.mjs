import test from 'node:test';
import assert from 'node:assert/strict';
import {createInactiveLiquidityPostgres} from '../docs/proposals/liquidity-inactive/postgres.mjs';
import {describeLiquidityPublication as bundle} from '../docs/proposals/liquidity-inactive/sidecars.mjs';
const file={name:'liquidity-history-evidence.json',bytes:Buffer.from('{"observed":true}')};
test('disabled transport never reads config, and rejects scope before connecting',()=>{
 assert.throws(()=>createInactiveLiquidityPostgres({get config(){throw Error('SECRET_READ');}}),/DISABLED/);
 for(const config of [{},{host:'other'},{host:'db.acwmtobcbpkjfqiatyke.supabase.co',port:6543},{connectionString:'secret'}])assert.throws(()=>createInactiveLiquidityPostgres({enabled:true,purpose:'executor',config}),/CONFIG/);
});
test('all failed/unknown/cancelled or sidecar bundles stay outside automatic artifact names',()=>{
 for(const conclusion of ['failure','unknown','cancelled']){
  const r=bundle({run:'123',conclusion,files:[file]});assert.equal(r.status,'QUARANTINED');assert.equal(/^liquidity-(reconciled|history)-[0-9]+$/.test(r.artifactName),false);assert.equal(r.checkpointEligible,false);
 }
 for(const suffix of ['.pending','.lock']){const r=bundle({run:'123',conclusion:'success',files:[file,{name:file.name+suffix,bytes:Buffer.from('diagnostic')}]});assert.equal(r.status,'QUARANTINED');assert.equal(r.entries.length,2);}
});
test('successful main file is review-only; malformed/missing main is quarantine',()=>{
 const r=bundle({run:'123',conclusion:'success',files:[file]});assert.equal(r.status,'REQUIRES_INDEPENDENT_REVIEW');assert.equal(r.checkpointEligible,false);assert.equal(r.automaticResume,false);
 for(const files of [[],[{...file,bytes:Buffer.from('{')}],[{...file,bytes:Buffer.from('null')}],[{name:file.name+'.pending',bytes:Buffer.from('{}')}]])assert.equal(bundle({run:'123',conclusion:'success',files}).status,'QUARANTINED');
});
test('bundle identities reject aliases/duplicates and hashes are order invariant',()=>{
 for(const files of [[file,file],[{...file,name:'../liquidity-history-evidence.json'}],[{...file,bytes:'not bytes'}]])assert.throws(()=>bundle({run:'123',conclusion:'success',files}));
 const side={name:file.name+'.lock',bytes:Buffer.from('lock')};assert.deepEqual(bundle({run:'123',conclusion:'failure',files:[side,file]}),bundle({run:'123',conclusion:'failure',files:[file,side]}));
});
