import test from 'node:test';
import * as scannerTrace from '../lib/scannerTrace.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const {code}=transformSync(fs.readFileSync(new URL('../lib/reliableConnection.js',import.meta.url),'utf8'),{filename:'connection.js',jsc:{parser:{syntax:'ecmascript'}},module:{type:'commonjs'}});
function factory(env={}){const ctx={exports:{},require:specifier=>specifier.includes('scannerTrace')?scannerTrace:({Connection:class{constructor(_url,options){this.fetch=options.fetch;}}}),process:{env},setTimeout,clearTimeout,AbortController,Response,Uint8Array,fetch:()=>{throw Error('UNEXPECTED_NETWORK');}};vm.runInNewContext(code,ctx);return ctx.exports.createReliableConnection;}
test('current Helius capacity failure uses the existing Alchemy integration once without credential changes',async()=>{
 const calls=[],create=factory({SOLANA_RPC_URL:'https://helius.invalid',ALCHEMY_SOLANA_ARCHIVE_RPC_URL:'https://alchemy.invalid'}),c=create({retries:0,timeoutMs:1500,fetchImpl:async url=>{calls.push(url);return url==='https://helius.invalid'?new Response('',{status:429}):Response.json({jsonrpc:'2.0',result:123});}});
 assert.equal((await (await c.fetch('ignored',{body:'{}'})).json()).result,123);assert.deepEqual(calls,['https://helius.invalid','https://alchemy.invalid']);
});
test('oversized current evidence fails closed before RPC JSON parsing',async()=>{
 const c=factory()({primary:'https://rpc.invalid',fallbacks:'',retries:0,timeoutMs:1500,maxResponseBytes:64,fetchImpl:async()=>Response.json({result:'x'.repeat(256)})});
 await assert.rejects(c.fetch('ignored',{body:'{}'}),/unavailable/);
});
