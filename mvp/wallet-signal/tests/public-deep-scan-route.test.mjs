import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync(new URL('../app/api/token/deep-scan/route.js',import.meta.url),'utf8');
test('public deep scan defaults disabled',()=>assert.match(route,/GLITCH_PUBLIC_DEEP_SCAN_ENABLED!=='true'/));
test('server validates identity before quota admission',()=>{
 const auth=route.indexOf('await verifyScanUser('),quota=route.indexOf('await quota.admit(');
 assert.ok(auth>0&&quota>auth);
});
test('existing active jobs reused before quota consumed',()=>{
 const existing=route.indexOf('const existing=await store.getLatest(mint)');
 const quota=route.indexOf('await quota.admit(');
 assert.ok(existing>0&&quota>existing);
 assert.match(route,/\['queued','running','partial'\]/);
});
test('new jobs use existing checkpoint store and snapshot preparer',()=>{
 assert.match(route,/prepareHolderScanSnapshot/);
 assert.match(route,/store.createOrReuse\(snapshot\)/);
});
