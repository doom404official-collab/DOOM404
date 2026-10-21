import test from 'node:test';
import assert from 'node:assert/strict';
import {assessBondingCurveFeeAuthorizationShadow as assess} from '../lib/pumpFunBondingCurveFeeAuthorizationShadow.mjs';
const slot=458811200;
const feePayments=[{kind:'PROTOCOL_FEE',recipient:'protocol-vault'},{kind:'CREATOR_FEE',recipient:'creator-vault'}];
test('missing historical state fails closed',()=>{const r=assess({transactionSlot:slot,feePayments});assert.equal(r.authorizationVerified,false);assert.equal(r.eligibleForLivePromotion,false);});
test('wrong slot cannot authorize recipients',()=>{const r=assess({transactionSlot:slot,feePayments,globalConfig:{slot:slot+1,verified:true,protocolFeeRecipients:['protocol-vault']},creatorFeeAuthority:{slot,verified:true,authorizedRecipients:['creator-vault']}});assert.equal(r.authorizationVerified,false);});
test('slot-matched independently verified fee roles are corroborated but never promotable',()=>{const r=assess({transactionSlot:slot,feePayments,globalConfig:{slot,verified:true,protocolFeeRecipients:['protocol-vault']},creatorFeeAuthority:{slot,verified:true,authorizedRecipients:['creator-vault']}});assert.equal(r.authorizationVerified,true);assert.equal(r.settlementVerified,false);assert.equal(r.independentlyVerified,false);assert.equal(r.eligibleForLivePromotion,false);});
test('unexpected recipient is not authorized',()=>{const r=assess({transactionSlot:slot,feePayments:[{kind:'PROTOCOL_FEE',recipient:'unknown'}],globalConfig:{slot,verified:true,protocolFeeRecipients:['protocol-vault']}});assert.equal(r.authorizationVerified,false);});
