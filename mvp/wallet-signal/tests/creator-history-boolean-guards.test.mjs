import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCreatorHistoricalCoverage} from '../lib/creatorHistoricalCoverage.mjs';

test('historical status never promotes truthy non-boolean archive evidence',()=>{
 for(const archiveVerified of ['true','false',1,{},[]]){
  const result=assessCreatorHistoricalCoverage({rpcExhausted:true,archiveVerified});
  assert.equal(result.archiveVerified,false);
  assert.equal(result.historyComplete,false);
  assert.equal(result.status,'ARCHIVE_COVERAGE_UNVERIFIED');
 }
});
test('historical status never promotes truthy non-boolean pagination evidence',()=>{
 for(const rpcExhausted of ['true','false',1,{},[]]){
  const result=assessCreatorHistoricalCoverage({rpcExhausted,archiveVerified:true});
  assert.equal(result.rpcPaginationExhausted,false);
  assert.equal(result.historyComplete,false);
  assert.equal(result.status,'PAGINATION_INCOMPLETE');
 }
});
test('strict verified flags and no pending signatures remain required together',()=>{
 for(const archiveVerified of [false,true]) for(const rpcExhausted of [false,true]){
  const complete=assessCreatorHistoricalCoverage({rpcExhausted,archiveVerified});
  assert.equal(complete.historyComplete,archiveVerified&&rpcExhausted);
  assert.equal(complete.status==='HISTORY_COMPLETE',complete.historyComplete);
  const pending=assessCreatorHistoricalCoverage({rpcExhausted,archiveVerified,pendingSignatures:['pending']});
  assert.equal(pending.historyComplete,false);
  assert.equal(pending.status,'TRANSACTIONS_PENDING');
 }
});
