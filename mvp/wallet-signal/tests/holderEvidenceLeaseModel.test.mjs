import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";

/** In-memory simulation of database lease invariants; no production rows touched. */
function leaseQueue(){
 const rows=new Map();
 return {
  insert(signature){rows.set(signature,{status:"pending",attempts:0,owner:null,expires:0});},
  claim(signature,worker,now){
   const r=rows.get(signature);
   if(!r||!["pending","unavailable"].includes(r.status)||r.attempts>=5||
      (r.owner!==null&&r.expires>=now))return false;
   r.owner=worker;r.expires=now+90000;return true;
  },
  finish(signature,worker,now,status){
   const r=rows.get(signature);
   if(!r||r.owner!==worker||r.expires<=now)return false;
   r.status=status;r.attempts++;r.owner=null;r.expires=0;return true;
  },
  get(signature){return {...rows.get(signature)};}
 };
}
test("expired lease can be reclaimed and stale worker cannot finish",()=>{
 const q=leaseQueue(),old=randomUUID(),fresh=randomUUID();q.insert("sig");
 assert.equal(q.claim("sig",old,0),true);
 assert.equal(q.claim("sig",fresh,1000),false);
 assert.equal(q.claim("sig",fresh,90001),true);
 assert.equal(q.finish("sig",old,90002,"verified"),false);
 assert.equal(q.finish("sig",fresh,90002,"verified"),true);
 assert.equal(q.get("sig").attempts,1);
});
test("exhausted retries cannot be reclaimed",()=>{
 const q=leaseQueue();q.insert("sig");
 for(let i=0;i<5;i++){
  const now=i*100000;
  assert.equal(q.claim("sig","worker",now),true);
  assert.equal(q.finish("sig","worker",now+1,"unavailable"),true);
 }
 assert.equal(q.claim("sig","new",600000),false);
});
test("completed evidence cannot be claimed again",()=>{
 const q=leaseQueue();q.insert("sig");
 assert.equal(q.claim("sig","worker",0),true);
 assert.equal(q.finish("sig","worker",1,"verified"),true);
 assert.equal(q.claim("sig","other",200000),false);
});
