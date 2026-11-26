import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {holderSetHash,reconcileHolderIdentities} from '../lib/holderSetIdentity.mjs';
const mint='mint',holders=[{tokenAccount:'accountA',ownerWallet:'A'},{tokenAccount:'accountB',ownerWallet:'B'}];
test('identity preserves original ordered algorithm and ignores balances',()=>{
 const expected=createHash('sha256').update(JSON.stringify({mint,accounts:[['accountA','A'],['accountB','B']]})).digest('hex');
 assert.equal(holderSetHash({mint,holders}),expected);
 assert.equal(holderSetHash({mint,holders:holders.map(h=>({...h,sharePct:7}))}),expected);
 assert.notEqual(holderSetHash({mint,holders:[...holders].reverse()}),expected);
 assert.throws(()=>holderSetHash({mint,holders:[holders[0],holders[0]]}),/DUPLICATE/);
});
test('matching wallets cannot invent frozen token accounts or a canonical job',()=>{
 const input={mint,jobs:[{id:'j',version:1,hash:holderSetHash({mint,holders}),holders}],snapshots:[{id:'s',slot:1,ranking:[{wallet:'A'},{wallet:'B'}]}]};
 const before=JSON.stringify(input),result=reconcileHolderIdentities(input);
 assert.equal(result.jobs[0].hashMatches,true);
 assert.equal(result.jobs[0].snapshots[0].walletSetMatches,true);
 assert.equal(result.jobs[0].snapshots[0].frozenAccountHash,null);
 assert.equal(result.jobs[0].snapshots[0].safeToAttachSnapshot,false);
 assert.equal(result.canonicalJobId,null);
 assert.equal(result.automaticRecoveryAllowed,false);
 assert.equal(JSON.stringify(input),before);
});
test('changed owner set and corrupted job hash remain visible',()=>{
 const result=reconcileHolderIdentities({mint,jobs:[{id:'j',hash:'wrong',holders}],snapshots:[{id:'s',ranking:[{wallet:'A'},{wallet:'C'}]}]});
 assert.equal(result.jobs[0].hashMatches,false);
 assert.deepEqual(result.jobs[0].snapshots[0].snapshotOnly,['C']);
 assert.deepEqual(result.jobs[0].snapshots[0].checkpointOnly,['B']);
});
