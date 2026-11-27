import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
export function loadJSX(file,source){
 const filename=file instanceof URL?file.pathname:file;
 const {code}=transformSync(source??fs.readFileSync(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
 const localRequire=specifier=>specifier.startsWith('.')?specifier.endsWith('.mjs')?require(path.resolve(path.dirname(filename),specifier)):loadJSX(path.resolve(path.dirname(filename),specifier+'.jsx')):require(specifier);
 const ctx={exports:{},require:localRequire};vm.runInNewContext(code,ctx);return ctx.exports;
}
