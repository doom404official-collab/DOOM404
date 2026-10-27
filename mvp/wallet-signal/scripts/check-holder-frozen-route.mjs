// Compiled route contract test; every outbound call is replaced with a strict mock.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {HOLDER_RETAIN19_POLICY as p} from '../lib/holderEligibleViewPolicy.mjs';
const require=createRequire(import.meta.url);
Object.assign(process.env,{SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'offline-only'});
const {GET}=require('../.next/server/app/api/holder-frozen-observation/route.js').routeModule.userland;
const fixture=()=>({id:p.snapshotId,mint:p.mint,slot:p.slot,status:'frozen',supply_raw:'1000',excluded_wallets:['1nc1nerator11111111111111111111111111111111'],holder_ranking:[p.infrastructurePool,...Array.from({length:19},(_,i)=>'2'.repeat(31)+'123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[i])].map(wallet=>({wallet,balance:'10'}))});
let calls=0,rows=[fixture()],http=200;
global.fetch=async(url,options)=>{calls++;assert.equal(new URL(url).origin,'https://database.invalid');assert.equal(new URL(url).pathname,'/rest/v1/glitch_top20_snapshots');assert.equal(options.method,'GET');return new Response(JSON.stringify(rows),{status:http,headers:{'Content-Type':'application/json'}});};
for(const [mint,status,count] of [['invalid',400,0],['1nc1nerator11111111111111111111111111111111',200,0],[p.mint,200,1]]){
 const r=await GET(new Request('http://localhost/api/holder-frozen-observation?mint='+mint));assert.equal(r.status,status);assert.equal(calls,count);assert.equal(r.headers.get('Cache-Control'),'no-store');
 if(count){const body=await r.json();assert.equal(body.observation.eligible.sharePct,19);assert.equal(body.finalScore,null);assert.equal(body.jobAssociationVerified,false);}
}
for(const [value,expected] of [[[],200],[[{...fixture(),slot:1}],503],[[{...fixture(),supply_raw:1000}],503],[[fixture(),fixture()],503]]){rows=value;const r=await GET(new Request('http://localhost/api/holder-frozen-observation?mint='+p.mint));assert.equal(r.status,expected);assert.equal((await r.json()).status,'unavailable');}
http=503;const r=await GET(new Request('http://localhost/api/holder-frozen-observation?mint='+p.mint));assert.equal(r.status,503);assert.equal((await r.json()).error,'Frozen Holder observation unavailable');
console.log(JSON.stringify({passed:true,cases:8,calls,mode:'compiled-route-mocked-fetch'}));
