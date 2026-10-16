import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const component=readFileSync(new URL('../app/HolderScanProgress.jsx',import.meta.url),'utf8');
const page=readFileSync(new URL('../app/page.js',import.meta.url),'utf8');
test('progress uses read-only status endpoint',()=>{
 assert.match(component,/\/api\/holder-scan-status\?mint=/);
 assert.doesNotMatch(component,/method:\s*['"]POST['"]/);
});
test('progress polling cleans up and avoids starting a scan',()=>{
 assert.match(component,/clearInterval\(timer\)/);
 assert.match(component,/controller\.abort\(\)/);
 assert.doesNotMatch(component,/holder-scan-start|\/api\/token\/deep-scan/);
});
test('token analysis includes progress and assessment separately',()=>{
 assert.match(page,/<HolderScanProgress mint=\{result\.mint\}/);
 assert.match(page,/<HolderNetworkAssessment mint=\{result\.mint\}/);
});
