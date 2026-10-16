import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync(new URL('../app/api/token/deep-scan/route.js',import.meta.url),'utf8');
const admission=readFileSync(new URL('../lib/customerScanAdmission.mjs',import.meta.url),'utf8');
test('public scan remains disabled by default',()=>assert.match(route,/GLITCH_PUBLIC_DEEP_SCAN_ENABLED!=='true'/));
test('route validates mint and uses server-side admission',()=>{
 assert.match(route,/new PublicKey/);
 assert.match(route,/await admitCustomerScan\(/);
 assert.match(route,/verifyScanUser/);
});
test('admission verifies identity before existing job and quota',()=>{
 assert.ok(admission.indexOf('await verifyUser(')<admission.indexOf('await store.getLatest('));
 assert.ok(admission.indexOf('await store.getLatest(')<admission.indexOf('await quota.admit('));
});
test('admission locks and rechecks before quota and snapshot',()=>{
 assert.match(admission,/await lockManager.acquire\(mint\)/);
 assert.match(admission,/await lockManager.release\(lock\)/);
 assert.match(admission,/await store.createOrReuse\(snapshot\)/);
});
