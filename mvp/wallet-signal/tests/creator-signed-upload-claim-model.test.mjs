import test from 'node:test';
import assert from 'node:assert/strict';
// Offline simulation of PostgreSQL unique-key INSERT ... ON CONFLICT DO NOTHING.
// This does not prove actual database permissions or transaction isolation.
function claimStore(){
 const ids=new Set();
 return async id=>{
  if(ids.has(id))return false;
  ids.add(id);
  return true;
 };
}
test('same claim cannot be issued twice',async()=>{
 const claim=claimStore();
 assert.equal(await claim('commit:bucket:object'),true);
 assert.equal(await claim('commit:bucket:object'),false);
});
test('parallel duplicate attempts admit one',async()=>{
 const claim=claimStore();
 const outcomes=await Promise.all(Array.from({length:20},()=>claim('same-id')));
 assert.equal(outcomes.filter(Boolean).length,1);
});
test('separate claim identities do not collide',async()=>{
 const claim=claimStore();
 assert.equal(await claim('first'),true);
 assert.equal(await claim('second'),true);
});
