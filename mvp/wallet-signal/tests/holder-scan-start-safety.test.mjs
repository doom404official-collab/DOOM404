import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync(new URL('../app/api/holder-scan-start/route.js',import.meta.url),'utf8');
test('existing queued, running and partial investigations are reused',()=>{
 assert.match(route,/\["queued","running","partial"\]\.includes\(existing\.status\)/);
});
test('scan start remains internal and disabled by default',()=>{
 assert.match(route,/GLITCH_HOLDER_SCAN_START_ENABLED/);
 assert.match(route,/GLITCH_HOLDER_SCAN_INTERNAL_TOKEN/);
});
