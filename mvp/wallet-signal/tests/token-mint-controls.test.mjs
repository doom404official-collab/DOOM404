import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeToken2022BinaryMint} from '../lib/token2022BinaryMint.mjs';
import {projectTokenMintControls} from '../lib/tokenMintControls.mjs';
import {scoreTokenSecurity} from '../lib/glitchAttributeEnginesV11.mjs';
const p=JSON.parse(readFileSync(new URL('./fixtures/token-security-474049119.json',import.meta.url)));
const info=decodeToken2022BinaryMint(p.value,p.mint).data.parsed.info;
const context={slot:p.context.slot,commitment:p.commitment};
test('current retained mint evidence yields explicit controls and unchanged authority score',()=>{
 const c=projectTokenMintControls(info,context);
 assert.equal(c.supplyRaw,'815041860837604');assert.equal(c.decimals,6);
 assert.deepEqual(c.flags,[]);assert.equal(c.additionalControlsResolved,true);
 assert.equal(c.slot,474049119);
 const score=scoreTokenSecurity({tokenProgram:'spl-token-2022',authoritiesParsed:true,mintAuthority:c.mintAuthority,freezeAuthority:c.freezeAuthority,feeExtensionVerified:true,feeApplicable:false});
 assert.equal(score.score,100);assert.equal(score.coveragePct,100);assert.equal(score.calibrated,false);
});
test('active authorities and every unsupported privilege remain warnings regardless of score',()=>{
 for(const extension of ['permanentDelegate','transferHook','pausableConfig','defaultAccountState','nonTransferable','futureUnknown']){
  const c=projectTokenMintControls({...info,mintAuthority:p.mint,extensions:[{extension}]},context);
  assert.equal(c.additionalControlsResolved,false);assert.equal(c.flags.length,2);assert.ok(c.flags.every(f=>f.severity==='critical'));
 }
});
test('malformed controls cannot certify absence',()=>{
 for(const patch of [{mintAuthority:undefined},{freezeAuthority:''},{supply:'-1'},{decimals:256},{extensions:[{},{}]},{extensions:[{extension:'tokenMetadata'},{extension:'tokenMetadata'}]}])assert.equal(projectTokenMintControls({...info,...patch},context),null);
 assert.equal(projectTokenMintControls(info,{slot:null}),null);
});
