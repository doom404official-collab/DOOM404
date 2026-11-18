import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const nextRequire=createRequire(require.resolve('next/package.json'));
const postcss=nextRequire('postcss');
test('Next resolves the pinned security-patched PostCSS runtime',()=>{
 assert.equal(nextRequire('postcss/package.json').version,'8.5.23');
 assert.equal(require('../package-lock.json').packages['node_modules/postcss'].version,'8.5.23');
});
test('untrusted CSS cannot load a local source map when from is absent',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'glitch-postcss-'));
 try{
  const map=path.join(dir,'private.map');
  writeFileSync(map,JSON.stringify({version:3,sources:['private.css'],sourcesContent:['SYNTHETIC_PRIVATE_MARKER'],names:[],mappings:''}));
  const root=postcss.parse(`a{color:red}/*# sourceMappingURL=${map} */`);
  assert.equal(root.source.input.map,undefined);
  assert.equal(root.first.selector,'a');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('ordinary CSS parsing and stringification remain compatible',()=>{
 const root=postcss.parse('a{color:red}');root.first.first.value='black';
 assert.equal(root.toString(),'a{color:black}');
});
