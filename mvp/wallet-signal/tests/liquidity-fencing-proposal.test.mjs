// DESIGN MODEL ONLY: desired transactions, not a runtime or proof of SQL locking.
import test from 'node:test';
import assert from 'node:assert/strict';
function model(){
 let state={epoch:0,lease:null,tip:'retained-87',receipts:{},admissions:{},reserved:0};
 return {read:()=>structuredClone(state),
  claim(run,now,until){if(state.lease&&state.lease.until>now)throw Error('BUSY');if(until<=now)throw Error('CLOSED_WINDOW');state.epoch++;state.lease={run,epoch:state.epoch,until};return state.epoch;},
  reserve(run,epoch,now,ceiling){const l=state.lease;if(!l||l.run!==run||l.epoch!==epoch||l.until<=now)throw Error('FENCED');if(state.reserved>=ceiling)throw Error('BUDGET');state.reserved++;},
  stage(r){if(state.receipts[r.id])throw Error('IMMUTABLE_RECEIPT');state.receipts[r.id]={...r,status:'quarantined'};},
  admit(id,p){const l=state.lease,r=state.receipts[id];if(!l||l.run!==p.run||l.epoch!==p.epoch||l.until<=p.now)throw Error('FENCED');
   if(!r||state.admissions[id]||r.run!==p.run||r.kind!=='history'||r.status!=='quarantined'||r.parent!==p.parent||state.tip!==p.parent||r.digest!==p.digest||!p.successfulRun||!p.independentReview)throw Error('QUARANTINED');
   const next=structuredClone(state);next.admissions[id]={operation:id,status:'admitted',digest:r.digest};next.tip=r.digest;next.lease=null;if(p.failBeforeCommit)throw Error('TRANSACTION_ABORT');state=next;}
 };
}
const receipt={id:'op1',run:'run-a',kind:'history',parent:'retained-87',digest:'candidate'},proof={run:'run-a',epoch:1,now:2,parent:'retained-87',digest:'candidate',successfulRun:true,independentReview:true};
test('proposed global lease fences concurrent/same-owner claims and expired epochs',()=>{
 const m=model(),epoch=m.claim('run-a',0,10);assert.throws(()=>m.claim('run-a',1,10),/BUSY/);assert.throws(()=>m.claim('replay',1,10),/BUSY/);m.reserve('run-a',epoch,2,1);assert.throws(()=>m.reserve('run-a',epoch,3,1),/BUDGET/);m.claim('replay',10,20);assert.throws(()=>m.reserve('run-a',epoch,11,60),/FENCED/);m.stage(receipt);assert.throws(()=>m.admit('op1',{...proof,now:11}));assert.equal(m.read().tip,'retained-87');
});
test('proposed admission requires exact parent/digest and successful independent review; replay stays quarantined',()=>{
 for(const patch of [{parent:'other'},{digest:'other'},{successfulRun:false},{independentReview:false},{now:10}]){const m=model();m.claim('run-a',0,10);m.stage(receipt);assert.throws(()=>m.admit('op1',{...proof,...patch}));assert.equal(m.read().tip,'retained-87');}
 const m=model();m.claim('run-a',0,10);m.stage({...receipt,kind:'replay'});assert.throws(()=>m.admit('op1',proof),/QUARANTINED/);
});
test('proposed atomic receipt/tip transition and lost acknowledgement reconciliation do not retry mutations',()=>{
 const m=model();m.claim('run-a',0,10);m.stage(receipt);const before=m.read();assert.throws(()=>m.admit('op1',{...proof,failBeforeCommit:true}));assert.deepEqual(m.read(),before);m.admit('op1',proof);const after=m.read();assert.equal(after.tip,'candidate');assert.equal(after.admissions.op1.status,'admitted');assert.equal(after.receipts.op1.status,'quarantined');assert.throws(()=>m.admit('op1',proof));assert.throws(()=>m.stage({...receipt,digest:'other'}));assert.deepEqual(m.read(),after);
});
