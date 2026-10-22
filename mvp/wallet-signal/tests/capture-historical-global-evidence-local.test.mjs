import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/capture-historical-global-evidence-local.mjs',import.meta.url));
function execute(env={}){
 const dir=mkdtempSync(join(tmpdir(),'glitch-archive-capture-'));
 try{
  const output=join(dir,'restricted.json');
  const r=spawnSync(process.execPath,[script],{encoding:'utf8',env:{...process.env,ALCHEMY_RPC_URL:'',GLITCH_RESTRICTED_CAPTURE:output,...env}});
  return {r,created:existsSync(output)};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('missing archive URL fails without writing',()=>{const {r,created}=execute();assert.notEqual(r.status,0);assert.match(r.stderr,/ALCHEMY_RPC_URL_MISSING/);assert.equal(created,false);});
test('rejects insecure archive URL before request',()=>{const {r,created}=execute({ALCHEMY_RPC_URL:'http://example.invalid'});assert.notEqual(r.status,0);assert.match(r.stderr,/ALCHEMY_RPC_URL_MISSING/);assert.equal(created,false);});
test('missing restricted output path fails before request',()=>{const {r,created}=execute({ALCHEMY_RPC_URL:'https://example.invalid',GLITCH_RESTRICTED_CAPTURE:''});assert.notEqual(r.status,0);assert.match(r.stderr,/GLITCH_RESTRICTED_CAPTURE_MISSING/);assert.equal(created,false);});
