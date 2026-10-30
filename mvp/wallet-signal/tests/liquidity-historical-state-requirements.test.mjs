import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalFeeStateRequirements} from '../lib/liquidityHistoricalStateRequirements.mjs';
test('creator fee requires only pool state',()=>{
 const r=historicalFeeStateRequirements({transactionSlot:100,feeSweeps:[
  {poolMatched:true,operation:'sweep_creator_fee',pool:'pool',globalConfigAddress:'config'}]});
 assert.deepEqual(r.accounts,[{address:'pool',role:'pump_amm_pool',field:'coin_creator'}]);
 assert.equal(r.authorizationVerified,false);
});
test('protocol fee requires only config state',()=>{
 const r=historicalFeeStateRequirements({transactionSlot:100,feeSweeps:[
  {poolMatched:true,operation:'sweep_protocol_fee',pool:'pool',globalConfigAddress:'config'}]});
 assert.deepEqual(r.accounts,[{address:'config',role:'pump_amm_global_config',field:'protocol_fee_recipients'}]);
});
test('duplicate requirements are deduplicated',()=>{
 const s={poolMatched:true,operation:'sweep_creator_fee',pool:'pool'};
 assert.equal(historicalFeeStateRequirements({transactionSlot:100,feeSweeps:[s,s]}).accounts.length,1);
});
test('unsupported operations and missing addresses cannot appear resolved',()=>{
 const r=historicalFeeStateRequirements({transactionSlot:100,feeSweeps:[
  {poolMatched:true,operation:'unknown',pool:'pool'},
  {poolMatched:true,operation:'sweep_creator_fee'}]});
 assert.equal(r.status,'INVALID_OR_INCOMPLETE_EVIDENCE');
 assert.equal(r.unresolved.length,2);
 assert.equal(r.authorizationVerified,false);
});
test('invalid list rejected',()=>{
 assert.throws(()=>historicalFeeStateRequirements({feeSweeps:null}),/INVALID_FEE_SWEEPS/);
});
