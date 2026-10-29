// Synthetic-only owner terminal rehearsal. No real pg import or network transport.
// Run only with the printed synthetic values, never a real credential.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';import net from 'node:net';
import {binding,response,U,R} from './owner-auth-fixture.mjs';
const mode=process.argv[2]??'success';
if(!['success','interrupt-prompt','eof-prompt','connection-error','connection-stall','read-stall','write-error','write-stall','interrupt-write','auth-error','auth-stall','interrupt-auth','reader-error'].includes(mode))throw Error('SYNTHETIC_MODE_REJECTED');
net.Socket.prototype.connect=function(){throw Error('SYNTHETIC_NETWORK_FORBIDDEN');};
const events=[],time=Math.floor(Date.now()/1000),seal=binding(time),pending=()=>new Promise(()=>{});
globalThis.__creatorSynthetic={events,mode,seal,pending};
globalThis.fetch=async(url,options)=>{
 const n=events.filter(x=>x==='auth').length+1;events.push('auth');
 const body=JSON.parse(options.body);
 if(url!=='https://acwmtobcbpkjfqiatyke.supabase.co/auth/v1/token?grant_type=password'||options.headers.apikey!=='sb_publishable_synthetic'||body.email!=='synthetic@example.invalid'||body.password!=='SYNTHETIC_PASSWORD')throw Error('SYNTHETIC_INPUT_ONLY');
 if(mode==='auth-error'||(mode==='reader-error'&&n===2))throw Error('SYNTHETIC_SECRET_ERROR');
 if(['auth-stall','interrupt-auth'].includes(mode)){console.log('SYNTHETIC_AUTH_PENDING');return pending();}
 return Response.json(response(n===1?U:R,time));
};
const dir=mkdtempSync(join(tmpdir(),'creator-owner-dryrun-'));
try{
 const candidate=join(dir,'candidate.sql'),ca=join(dir,'ca.pem');
 writeFileSync(candidate,'BEGIN; SELECT 1; COMMIT;');writeFileSync(ca,'SYNTHETIC CA');
 writeFileSync(join(dir,'pg-stub.mjs'),`export class Client {
 constructor(c){const f=globalThis.__creatorSynthetic;this.f=f;if(c.password!=='SYNTHETIC_PASSWORD'||c.host!=='db.acwmtobcbpkjfqiatyke.supabase.co'||c.ssl.rejectUnauthorized!==true||c.ssl.servername!==c.host)throw Error('SYNTHETIC_INPUT_ONLY');this.connection={stream:{destroy(){f.events.push('destroy');}}};f.events.push('construct');}
 on(){} async connect(){this.f.events.push('connect');if(this.f.mode==='connection-stall')return this.f.pending();if(this.f.mode==='connection-error')throw Error('SYNTHETIC_SECRET_ERROR');}
 async query(q,values){const {events,mode,seal,pending}=this.f;events.push(q.startsWith('SELECT')?'read':q.startsWith('CREATE')?'temp':q.startsWith('INSERT')?'input':'dispatch');
 if(q.startsWith('SELECT')){if(mode==='read-stall')return pending();return {rows:[{binding:seal}]};}
 if(q.startsWith('INSERT')){const p=JSON.parse(values[0]);if(Object.keys(p.storageSessions).join(',')!=='upload,readback'||JSON.stringify(p).includes('REFRESH'))throw Error('SYNTHETIC_MEMORY_HANDOFF_FAILED');}
 if(q.startsWith('BEGIN')){if(mode==='write-error')throw Error('SYNTHETIC_SECRET_ERROR');if(['write-stall','interrupt-write'].includes(mode)){console.log('SYNTHETIC_WRITE_PENDING');return pending();}}return {};}
 async end(){this.f.events.push('end');return this.f.pending();}
 }`);
 let source=readFileSync(new URL('../../../docs/proposals/creator-evidence-integration/install-runtime-delivery.mjs.in',import.meta.url),'utf8');
 source=source.replace("from 'pg'","from './pg-stub.mjs'").replace("from '../../../lib/creatorEvidenceOwnerSessions.mjs'",'from '+JSON.stringify(new URL('../../../lib/creatorEvidenceOwnerSessions.mjs',import.meta.url).href)).replace('const enabled=false;','const enabled=true;');
 const script=join(dir,'synthetic-installer.mjs');writeFileSync(script,source);
 console.log('SYNTHETIC ONLY: use SYNTHETIC_PASSWORD, sb_publishable_synthetic, synthetic@example.invalid, SYNTHETIC_PASSWORD, synthetic@example.invalid, SYNTHETIC_PASSWORD in prompt order.');
 process.argv=[process.execPath,script,candidate,createHash('sha256').update(readFileSync(candidate)).digest('hex'),ca];
 await import(pathToFileURL(script).href);
 console.log('SYNTHETIC_EVENTS='+JSON.stringify(events));
}finally{delete globalThis.__creatorSynthetic;rmSync(dir,{recursive:true,force:true});}
