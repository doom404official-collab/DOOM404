import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,openSync,closeSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
test('scheduled holder workflow logs only explicit identity with mocked HTTP',()=>{
 const dir=mkdtempSync(join(tmpdir(),'holder-workflow-'));
 const output=join(dir,'output');const fd=openSync(output,'w');
 try{
  const result=spawnSync('python3',[fileURLToPath(new URL('../../../.github/tests/test_holder_tick_observability.py',import.meta.url))],
   {stdio:['ignore',fd,fd],timeout:10000});
  assert.ifError(result.error);assert.equal(result.signal,null);
  assert.equal(result.status,0,readFileSync(output,'utf8'));
 }finally{closeSync(fd);rmSync(dir,{recursive:true,force:true});}
});
