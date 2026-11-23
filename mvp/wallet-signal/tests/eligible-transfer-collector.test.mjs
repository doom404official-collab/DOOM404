import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('priority-1 variant reuses all 21 synthetic transport/projection checks',()=>{
 const out=spawnSync('python3',['-B','tests/fixed_transfer_collector_checks.py','--eligible-variant'],{encoding:'utf8'});
 assert.equal(out.status,0,out.stdout+out.stderr);assert.match(out.stdout,/OFFLINE_COLLECTOR_CHECKS=21/);
});
test('fixed variant identity, original isolation and inactive workflow proposals retain closed contracts',()=>{
 const out=spawnSync('python3',['-B','-c',`
import importlib.util,sys,json
sys.path.insert(0,'scripts')
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
old=load('old','scripts/collect-fixed-transfer-witness.py')
v=load('variant','scripts/collect-eligible-transfer-witness.py').collector
assert old.SLOT==450097547 and v.SLOT==450525312
assert old.SIGNATURE.startswith('37WZY') and v.SIGNATURE=='5ZRFzrYTEKEeRdU7FPABcdfvkz2PxFdNQxt7ApTWDYNHfmBmPPRPotp5NYLAMMjaEnP4QxxKJnJSN5XqfgzG1K6G'
assert v.REQUEST['params']==[v.SIGNATURE,{'commitment':'finalized','encoding':'json','maxSupportedTransactionVersion':0}]
assert v.MINT==old.MINT and v.DEADLINE_SECONDS==30 and v.MAX_BYTES==2097152
print('PINS_OK')`],{encoding:'utf8'});
 assert.equal(out.status,0,out.stderr);assert.match(out.stdout,/PINS_OK/);
 const original=readFileSync(new URL('./fixtures/transfer-witness-44272054942/projection.json',import.meta.url));
 assert.equal(createHash('sha256').update(original).digest('hex'),'6e54ec856837729bffeb25ac1acb1a346eaec044d830b534bee71cd674328942');
 const inventoryProposal=readFileSync(new URL('../docs/proposals/lp-inventory-workflow.yml',import.meta.url),'utf8');
 assert.ok(inventoryProposal.includes('run: python3 scripts/collect-lp-inventory.py --approved-once'));
 assert.ok(!inventoryProposal.includes('scripts/collect-eligible-transfer-witness.py'));assert.ok(!inventoryProposal.includes('scripts/collect-fixed-transfer-witness.py'));
 for(const [file,hash] of [['collect-fixed-transfer-witness.py','8d171e8602321f55d24d7016866a6334602406fead7e872370383618343d9ba7'],['fixed_transfer_projection.py','d3b84f7e9c8b51fa1cb3109423fe32f3f349bce2b993a2b26b89ed0faf420cb3']])assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/'+file,import.meta.url))).digest('hex'),hash);
 const proposal=readFileSync(new URL('../docs/proposals/eligible-transfer-witness.workflow.yml',import.meta.url),'utf8');
 const poolProposal=readFileSync(new URL('../docs/proposals/fixed-pool-accounts-workflow.yml',import.meta.url),'utf8');
 assert.equal(createHash('sha256').update(poolProposal).digest('hex'),'0872e6bc06991bf561b5c917354fbe90f7a18cb070c195058216a81fa10482af');

 for(const text of ["event['repository']['full_name']=='doom404official-collab/DOOM404'","approved_public_projection')=='true'","GITHUB_EVENT_NAME']=='workflow_dispatch'","GITHUB_REF']=='refs/heads/integration/glitch-app-main-20261118'","GITHUB_RUN_ATTEMPT']=='1'","GITHUB_SHA']==os.environ['REVIEWED_SHA']","re.fullmatch('[0-9a-f]{40}',os.environ['REVIEWED_SHA'])",'contents: read','persist-credentials: false','retention-days: 1','overwrite: false','default: false','timeout-minutes: 3','cancel-in-progress: false','group: glitch-lp-inventory-accounts-single','actions/checkout@11d5960a326750d5838078e36cf38b85af677262','actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02','secrets.ALCHEMY_SOLANA_ARCHIVE_RPC_URL','lp-inventory-private/public/projection.json','lp-inventory-private/public/manifest.json',"success() && steps.capture.outcome == 'success'","not root.is_symlink()","stat.S_ISREG(p.lstat().st_mode)"])assert.ok(inventoryProposal.includes(text),text);
 assert.match(inventoryProposal,/on:\n  workflow_dispatch:/);
 const uploadPaths=inventoryProposal.split('          path: |\n')[1].split('          retention-days:')[0].trim().split('\n').map(x=>x.trim());
 assert.deepEqual(uploadPaths,['mvp/wallet-signal/lp-inventory-private/public/projection.json','mvp/wallet-signal/lp-inventory-private/public/manifest.json']);
 for(const forbidden of ['always()','response.bin','push:','pull_request:','schedule:','id-token:','npm install','eligible-transfer-private'])assert.ok(!inventoryProposal.includes(forbidden),forbidden);
 for(const text of ["approved_public_projection')=='true'","GITHUB_RUN_ATTEMPT']=='1'","GITHUB_SHA']==os.environ['REVIEWED_SHA']",'persist-credentials: false','retention-days: 1','overwrite: false','default: false','scripts/collect-eligible-transfer-witness.py','eligible-transfer-private/public/projection.json','eligible-transfer-private/public/manifest.json'])assert.ok(proposal.includes(text));
 for(const forbidden of ['always()','response.bin','push:','pull_request:','schedule:'])assert.ok(!proposal.includes(forbidden));
});
