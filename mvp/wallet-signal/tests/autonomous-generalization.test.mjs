import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {Keypair,PublicKey} from '@solana/web3.js';import {poolPda} from '@pump-fun/pump-swap-sdk';
import {canonicalHolderObservationIdentity,projectCanonicalHolderObservation} from '../lib/canonicalHolderObservation.mjs';
import {projectHolderRelationshipsV2} from '../lib/holderRelationshipsV2.mjs';import {reconcileLiquidityLq09} from '../lib/liquidityLq09Reconciliation.mjs';import {inspectRoutedTokenTrade} from '../lib/routedTokenTrade.mjs';
import {withScannerAdmissionFixture} from './helpers/scanner-admission-fixture.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,import.meta.url)));const key=()=>Keypair.generate().publicKey.toBase58();
const hash=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
test('canonical snapshot schema validates an unrelated mint without a pinned token, slot or artifact',()=>{
 const r=read('./fixtures/canonical-holder-474029636.json'),s=r.observation;r.mint=s.mint=key();r.snapshot_slot=s.contextSlots.inventory=s.contextSlots.mint=500;s.contextSlots.classifications=501;
 for(const h of [...s.eligibleHolders,...s.excludedWallets])h.authorityAccount.contextSlot=501;
 s.holderSetHash=hash({version:2,mint:r.mint,holders:s.eligibleHolders.map(h=>[h.wallet,h.tokenAccounts.map(t=>t.tokenAccount)])});r.id=canonicalHolderObservationIdentity(s);
 const p=projectCanonicalHolderObservation(r,r.mint);assert.equal(p.snapshotId,r.id);assert.equal(p.top20SharePct,24.5379);assert.equal(p.scoreEligible,false);assert.throws(()=>projectCanonicalHolderObservation(r,key()));
});
test('relationship identity is recomputed from any mint and exact account membership; altered hash fails closed',()=>{
 const checkpoint=read('./fixtures/canonical-holder-checkpoint-20261126.json');checkpoint.mint=key();checkpoint.snapshot.slot=501;checkpoint.snapshot.holderSetHash=hash({version:2,mint:checkpoint.mint,holders:checkpoint.holders.map(h=>[h.ownerWallet,h.tokenAccounts.map(t=>t.tokenAccount)])});
 const row={mint:checkpoint.mint,holder_set_hash:checkpoint.snapshot.holderSetHash,checkpoint},p=projectHolderRelationshipsV2(row,row.mint);assert.ok(p?.relationshipCount>0);assert.equal(p.snapshotSlot,501);assert.equal(p.commonOwnershipEstablished,false);
 row.holder_set_hash='0'.repeat(64);assert.equal(projectHolderRelationshipsV2(row,row.mint),null);
});
test('historical fee settlement binds an unrelated mint/pool and arbitrary matching historical slot',()=>{
 const a=read('./fixtures/lq09-458811200.json'),pool=a.records.find(r=>r.role==='pump_amm_pool'),oldPool=pool.address,b=Buffer.from(pool.account.data[0],'base64'),mint=Keypair.generate().publicKey;mint.toBuffer().copy(b,43);
 const address=poolPda(b.readUInt16LE(9),new PublicKey(b.subarray(11,43)),mint,new PublicKey(b.subarray(75,107))).toBase58();pool.address=address;pool.account.data[0]=b.toString('base64');pool.accountDataSha256=createHash('sha256').update(b).digest('hex');
 for(const k of a.transaction.transaction.message.accountKeys)if(k.pubkey===oldPool)k.pubkey=address;
 for(const ix of [...a.transaction.transaction.message.instructions,...a.transaction.meta.innerInstructions.flatMap(g=>g.instructions)])if(ix.accounts)ix.accounts=ix.accounts.map(x=>x===oldPool?address:x);
 for(const phase of ['preTokenBalances','postTokenBalances'])for(const balance of a.transaction.meta[phase])if(balance.owner===oldPool)balance.owner=address;
 for(const g of a.transaction.meta.innerInstructions)for(const ix of g.instructions)if(ix.parsed?.info?.authority===oldPool)ix.parsed.info.authority=address;
 a.requestedSlot=a.transaction.slot=500;for(const r of a.records)r.requestedSlot=r.contextSlot=500;
 const p=reconcileLiquidityLq09(a,mint.toBase58());assert.equal(p.mint,mint.toBase58());assert.equal(p.amounts.totalTransferRaw,'2603773');assert.equal(p.scoreEligible,false);assert.throws(()=>reconcileLiquidityLq09(a,key()));
});
const route=n=>read('../docs/forensic-ri76-90/dcty-history-'+n+'.json').response.result;
const input=n=>{const transaction=route(n);return {mint:'9hjBLBrc7WZW2H8UQvBAvG5WiTZotXUv2Bdcn4f4pump',creator:'HCJLK3C1Mgke9Kxkz9fCZTebzuubPdmz8gx94gppkYXP',signature:transaction.transaction.signatures[0],transaction};};
for(const [n,raw]of [[3,'660146971'],[5,'866466823'],[21,'31599953']])test('recorded nested routed sell reconciles exact target amount '+n,()=>{const r=inspectRoutedTokenTrade(input(n));assert.equal(r.event?.type,'VERIFIED_SALE');assert.equal(r.event.amountRaw,raw);assert.equal(r.event.settlementVerified,true);});
test('Jupiter intermediate target movements with zero net delta never become acquisitions or sales',()=>{const r=inspectRoutedTokenTrade(input(30));assert.equal(r.status,'no_net_target_trade');assert.equal(r.event,null);});
for(const [name,change] of [['failed execution',i=>i.transaction.meta.err={}],['wrong creator',i=>i.creator=key()],['unsigned trader',i=>i.transaction.transaction.message.accountKeys.find(k=>k.pubkey===i.creator).signer=false],['wrong raw delta',i=>i.transaction.meta.postTokenBalances.find(b=>b.mint===i.mint&&b.owner===i.creator).uiTokenAmount.amount='1'],['invalid stack',i=>i.transaction.meta.innerInstructions.find(g=>g.index===2).instructions[1].stackHeight=2],['missing settlement',i=>i.transaction.meta.innerInstructions.find(g=>g.index===2).instructions[2].parsed.info.tokenAmount.amount='0']])test('routed settlement rejects '+name,()=>{const i=input(3);change(i);assert.equal(inspectRoutedTokenTrade(i).event,null);});
for(const route of ['holder-network-merge-controlled','holder-scan-recovery','liquidity-archive-state-verify','internal/holder-scan-smoke'])test('retired reference endpoint cannot reach stores/providers: '+route,async()=>{
 const source=withScannerAdmissionFixture(fs.readFileSync(new URL('../app/api/'+route+'/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export async function POST','async function POST');
 const post=new Function(source+'\nreturn POST;')(),r=await post(new Request('https://example.invalid',{method:'POST'}));assert.equal(r.status,410);assert.equal((await r.json()).historicalEvidencePreserved,true);assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('production import graph excludes reference fixtures and known fixture mint literals',()=>{
 const root=new URL('../',import.meta.url).pathname,seen=new Set(),pending=[];const walk=p=>{for(const f of fs.readdirSync(p,{withFileTypes:true})){const n=path.join(p,f.name);if(f.isDirectory())walk(n);else if(/\.(js|jsx|mjs)$/.test(n))pending.push(n);}};walk(path.join(root,'app'));
 const forbidden=['98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump','9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump','Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump','9hjBLBrc7WZW2H8UQvBAvG5WiTZotXUv2Bdcn4f4pump','3Tg6YnNrfPdFfsY14MaNsDMWLseAyrUDS3myJtbaJN6f'];
 while(pending.length){const file=pending.pop();if(seen.has(file))continue;seen.add(file);const source=fs.readFileSync(file,'utf8');for(const mint of forbidden)assert.ok(!source.includes(mint),path.relative(root,file)+' retains fixture mint');
  for(const m of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){if(!m[1].startsWith('.'))continue;const p=path.resolve(path.dirname(file),m[1]),target=[p,p+'.mjs',p+'.js',p+'.jsx'].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());if(!target)continue;assert.ok(!/\/(tests|scripts)\//.test(target),'Runtime must not import reference fixtures');pending.push(target);}
 }
 assert.ok(seen.size>100);
});
for(const [n,type]of [[32,'VERIFIED_SALE'],[33,'PURCHASE']])test('recorded Pump curve V2/V3 routed target settlement '+n,()=>{const r=inspectRoutedTokenTrade(input(n));assert.equal(r.event?.type,type);assert.equal(r.event.amountRaw,'62657905488883');assert.equal(r.event.protocol,'pump_fun');});
const cateInput=()=>{const transaction=read('../docs/forensic-ri76-90/cate-origin.json').response.result;return {mint:'Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump',creator:'D9gQ6RhKEpnobPBUdWY5bPQt2p3zGk3iVz6ChpUi2ArA',signature:transaction.transaction.signatures[0],transaction};};
test('CATE native SOL purchase and same-transaction issuance reconcile as a market purchase',()=>{const r=inspectRoutedTokenTrade(cateInput());assert.equal(r.event?.type,'PURCHASE');assert.equal(r.event.amountRaw,'96449438144093');assert.equal(r.event.quoteSettlement,'native_sol_system_transfers');assert.equal(r.event.quoteDebitIncludingObservedFeesRaw,'3000000000');});
for(const [name,change]of [['unverified zero opening',i=>i.transaction.meta.preBalances[i.transaction.transaction.message.accountKeys.findIndex(k=>k.pubkey==='3jNo7eYYhLFrRXSpYEevBCYj8uJioA95sH1MujyB1GJk')]=1],['issuance mismatch',i=>i.transaction.meta.innerInstructions.flatMap(g=>g.instructions).find(ix=>ix.parsed?.type==='mintTo').parsed.info.amount='999'],['native settlement mismatch',i=>i.transaction.meta.postBalances[i.transaction.transaction.message.accountKeys.findIndex(k=>k.pubkey==='3Sg92V4Mre9Apm7dJsM39B6vrAEVVErE1vBsZMKyUbxT')]++]])test('native purchase rejects '+name,()=>{const i=cateInput();change(i);assert.equal(inspectRoutedTokenTrade(i).event,null);});
