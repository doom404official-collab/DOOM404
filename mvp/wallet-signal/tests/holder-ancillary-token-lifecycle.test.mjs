import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {holderTransferContext} from '../lib/holderTransferContext.mjs';
import {validNetworkAddress} from '../lib/holderNetworkTransfers.mjs';
const p=JSON.parse(readFileSync(new URL('./fixtures/transfer-witness-44272054942/projection.json',import.meta.url)));
const keys=p.message.accountKeys,SPL=keys[28],T22=keys[29];
const parsed=(type,info,programId=SPL)=>({programId,program:'spl-token',parsed:{type,info}});
function context(instructions){
 // Synthetic schema probe; no claim this is authentic full jsonParsed evidence.
 return holderTransferContext({transaction:{message:{accountKeys:keys,instructions}},
 meta:{innerInstructions:[],preTokenBalances:p.preTokenBalances,postTokenBalances:p.postTokenBalances}},p.signature,validNetworkAddress);
}
const size=parsed('getAccountDataSize',{mint:keys[27],extensionTypes:['immutableOwner']});
const init=parsed('initializeImmutableOwner',{account:keys[2]});
test('retained exact raw ancillary bytes are decoded narrowly without creating owners',()=>{
 const group=p.innerInstructions.find(g=>g.index===2);
 const raw=i=>({...i,programId:keys[i.programIdIndex],accounts:i.accounts.map(n=>keys[n])});
 const c=context([raw(group.instructions[0]),raw(group.instructions[2])]);
 assert.equal(group.instructions[0].data,'84eT');assert.equal(group.instructions[2].data,'P');
 assert.equal(c.opaqueOwnership,false);assert.deepEqual([...c.conflicts],[keys[2]]);
 assert.equal(c.owners.has(keys[2]),false);
 for(const idx of [7,9])assert.equal(c.owners.has(keys[idx]),true);
});
test('official parsed shapes permit size query and quarantine immutable initialization on either canonical program',()=>{
 for(const programId of [SPL,T22]){
 for(const info of [{mint:keys[27]},{mint:keys[27],extensionTypes:[]},size.parsed.info]){
 assert.equal(context([{...size,programId,parsed:{type:'getAccountDataSize',info}}]).opaqueOwnership,false);
 }
 const c=context([{...init,programId}]);assert.equal(c.opaqueOwnership,false);assert.ok(c.conflicts.has(keys[2]));
 }
});
test('malformed parsed variants and contradictory account sets stay globally opaque',()=>{
 const cases=[
 {...size,programId:keys[25]}, {...size,programId:'bad'},
 parsed('getAccountDataSize',null),parsed('getAccountDataSize',[]),
 parsed('getAccountDataSize',{}),parsed('getAccountDataSize',{mint:'bad'}),
 parsed('getAccountDataSize',{mint:'3'.repeat(32)}),
 parsed('getAccountDataSize',{mint:keys[27],extensionTypes:null}),
 parsed('getAccountDataSize',{mint:keys[27],extensionTypes:['unknown']}),
 parsed('getAccountDataSize',{mint:keys[27],extensionTypes:['immutableOwner','immutableOwner']}),
 parsed('getAccountDataSize',{mint:keys[27],account:keys[2]}),
 parsed('initializeImmutableOwner',{}),parsed('initializeImmutableOwner',{account:keys[2],owner:keys[0]}),
 {...size,accounts:[]},{...size,accounts:[keys[27],keys[2]]},{...size,accounts:[keys[2]]},
 {...init,accounts:[2]},{...init,data:'84eT',accounts:[keys[2]]},
 {...size,data:'N',accounts:[keys[27]]}, // empty raw extensions contradict parsed immutableOwner
 {...init,parsed:{type:'unknown',info:{account:keys[2]}}}
 ];
 for(const [i,ix] of cases.entries())assert.equal(context([ix]).opaqueOwnership,true,`case ${i}`);
});
test('malformed or unknown raw bytes/account lists never gain safe status',()=>{
 for(const data of ['', '0','1P','PP','84e','84eU','111111','Q',null,['P','base58']]){
 assert.equal(context([{programId:SPL,data,accounts:[keys[2]]}]).opaqueOwnership,true,String(data));
 }
 for(const accounts of [[],[2],[keys[2],keys[27]],['bad'],['3'.repeat(32)],null]){
 assert.equal(context([{programId:SPL,data:'P',accounts}]).opaqueOwnership,true);
 }
 assert.equal(context([{programId:SPL,data:'N',accounts:[keys[27]]}]).opaqueOwnership,false);
});
test('setAuthority/create/close conflicts and unknown variants remain conservative',()=>{
 const changes=[
 parsed('setAuthority',{account:keys[7]}),
 parsed('closeAccount',{account:keys[7]}),
 parsed('initializeAccount3',{account:keys[7]}),
 parsed('createAccount',{newAccount:keys[7]},keys[12])
 ];
 for(const change of changes){
 const c=context([size,init,change]);assert.equal(c.opaqueOwnership,false);assert.ok(c.conflicts.has(keys[7]));
 }
 assert.equal(context([size,init,parsed('futureInstruction',{account:keys[2]})]).opaqueOwnership,true);
 assert.equal(context([parsed('initializeImmutableOwner',{account:keys[7]})]).conflicts.has(keys[7]),true);
});
