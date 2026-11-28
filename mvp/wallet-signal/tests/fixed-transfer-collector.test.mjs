import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('fixed collector synthetic transport and durable response contracts',()=>{
 const out=spawnSync('python3',['tests/fixed_transfer_collector_checks.py'],{encoding:'utf8'});
 assert.equal(out.status,0,out.stdout+out.stderr);
 assert.match(out.stdout,/OFFLINE_COLLECTOR_CHECKS=21/);
});
test('inactive transfer proposal seals manual dispatch and excludes raw artifact storage',()=>{
 const s=readFileSync(new URL('../docs/proposals/eligible-transfer-witness.workflow.yml',import.meta.url),'utf8');
 for(const contract of ["approved_public_projection')=='true'","GITHUB_RUN_ATTEMPT']=='1'","GITHUB_SHA']==os.environ['REVIEWED_SHA']",'persist-credentials: false','retention-days: 1','overwrite: false','secrets.ALCHEMY_SOLANA_ARCHIVE_RPC_URL'])assert.ok(s.includes(contract),contract);
 assert.ok(!s.includes('always()'));assert.ok(!s.includes('response.bin'));
 assert.ok(s.includes('public/projection.json'));assert.ok(s.includes('public/manifest.json'));
 assert.match(s,/on:\n  workflow_dispatch:/);assert.ok(!s.includes('push:'));assert.ok(!s.includes('pull_request:'));
 assert.ok(s.includes('default: false'));
 assert.ok(s.includes('actions/checkout@11d5960a326750d5838078e36cf38b85af677262'));
 assert.ok(s.includes('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'));
 assert.ok(!s.includes('schedule:'));assert.ok(!s.includes('npm install'));
});

test('active H06 preserves the restored main manual operation, not a one-shot capture',()=>{
 const bytes=readFileSync(new URL('../../../.github/workflows/glitch-holder-h06-pump-operation.yml',import.meta.url));
 // Verified main a24e1411 restoration; this pin covers all workflow bytes.
 assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),'13be0f4404fe2ba4b4da4a8b72054e0ec0192392');
 const s=bytes.toString('utf8');
 assert.match(s,/on:\n  workflow_dispatch:\npermissions:\n  contents: read\n/);
 assert.match(s,/ref: feature\/glitch-assessment-sprint1\n/);
 assert.match(s,/timeout-minutes: 5\n/);
 assert.match(s,/run: node scripts\/holder-h06-pump-operation\.mjs\n/);
 for(const forbidden of ['push:','pull_request:','schedule:','contents: write','id-token:',
  'scripts/collect-','--approved-once','approved_public_projection','ALCHEMY_SOLANA_ARCHIVE_RPC_URL',
  'upload-artifact','response.bin','public/projection.json','public/manifest.json'])assert.ok(!s.includes(forbidden),forbidden);
});
