"""Synthetic PTY tests of the disabled installer proposal; no network/real secrets."""
import os,pty,select,subprocess,tempfile,pathlib,hashlib,time,json,termios
root=pathlib.Path(__file__).resolve().parents[3]
source=(root/'docs/proposals/creator-evidence-integration/install-runtime-delivery.mjs.in').read_text()
with tempfile.TemporaryDirectory(prefix='creator-installer-') as td:
 p=pathlib.Path(td);(p/'candidate.sql').write_text('BEGIN; SELECT 1; COMMIT;');(p/'ca.pem').write_text('SYNTHETIC CA')
 digest=hashlib.sha256((p/'candidate.sql').read_bytes()).hexdigest()
 (p/'stub.mjs').write_text('''import {appendFileSync} from 'node:fs';
 const event=v=>appendFileSync(process.env.EVENT_FILE,JSON.stringify(v)+'\\n');
 const mode=process.env.TEST_MODE;const pending=()=>new Promise(()=>{});
 export class Client {
 constructor(c){if(c.user!=='postgres'||c.host!=='db.acwmtobcbpkjfqiatyke.supabase.co'||c.ssl.rejectUnauthorized!==true||c.ssl.servername!==c.host)throw Error('BAD_CONFIG');this.connection={stream:{destroy(){event('destroy');}}};event('construct');}
 on(){} async connect(){event('connect');if(mode==='connection-stall')return pending();if(mode==='connection-error')throw Error('SYNTHETIC_SECRET_ERROR');}
 async query(q){event(q.startsWith('SELECT')?'read':q.startsWith('CREATE')?'temp':q.startsWith('INSERT')?'input':'dispatch');
 if(q.startsWith('SELECT')){if(mode==='read-stall')return pending();return {rows:[{binding:{projectRef:'acwmtobcbpkjfqiatyke'}}]};}
 if(q.startsWith('BEGIN')){if(mode==='write-error')throw Error('SYNTHETIC_SECRET_ERROR');if(['write-stall','interrupt-write'].includes(mode))return pending();}return {};}
 async end(){event('end');if(mode==='success')return pending();}
 }''')
 (p/'installer.mjs').write_text(source.replace("from 'pg'","from './stub.mjs'").replace('const enabled=false;','const enabled=true;'))
 secrets=['SYNTHETIC_PASSWORD_817','SYNTHETIC_UPLOAD_918','SYNTHETIC_READER_619','SYNTHETIC_PUBLISHABLE_720']
 for mode in ['success','interrupt-prompt','eof-prompt','connection-error','connection-stall','read-stall','write-error','write-stall','interrupt-write']:
  events=p/(mode+'.jsonl');master,slave=pty.openpty();before=termios.tcgetattr(slave)
  child=subprocess.Popen(['node',str(p/'installer.mjs'),str(p/'candidate.sql'),digest,str(p/'ca.pem')],stdin=slave,stdout=slave,stderr=slave,env={**os.environ,'TEST_MODE':mode,'EVENT_FILE':str(events)},start_new_session=True)
  output=b'';sent=0;interrupted=False;deadline=time.monotonic()+18
  try:
   while child.poll() is None:
    if time.monotonic()>deadline:raise AssertionError('unbounded '+mode)
    if select.select([master],[],[],.05)[0]:output+=os.read(master,65536)
    prompts=output.count(b'(hidden): ')
    if mode in ['interrupt-prompt','eof-prompt'] and prompts and not interrupted:
     os.write(master,b'\x03' if mode=='interrupt-prompt' else b'\x04');interrupted=True
    elif mode not in ['interrupt-prompt','eof-prompt'] and prompts>sent:
     os.write(master,(secrets[sent]+'\n').encode());sent+=1
    if mode=='interrupt-write' and events.exists() and '"dispatch"' in events.read_text() and not interrupted:
     os.write(master,b'\x03');interrupted=True
   while select.select([master],[],[],.05)[0]:output+=os.read(master,65536)
   text=output.decode(errors='replace');ev=[json.loads(x) for x in events.read_text().splitlines()] if events.exists() else []
   assert all(s not in text for s in secrets+['SYNTHETIC_SECRET_ERROR']),text
   assert termios.tcgetattr(slave)[3]&termios.ECHO==before[3]&termios.ECHO,'terminal state not restored'
   expected='DELIVERY_INSTALL_REPORTED_VERIFY_PRIVILEGES' if mode=='success' else 'INSTALL_OUTCOME_UNKNOWN_RECONCILE' if mode in ['write-error','write-stall','interrupt-write'] else 'NOT_INSTALLED'
   assert expected in text,(mode,text,ev)
   assert ev.count('dispatch')==(1 if mode in ['success','write-error','write-stall','interrupt-write'] else 0),ev
   if 'construct' in ev:assert 'destroy' in ev and 'end' in ev,ev
   assert child.returncode==(0 if mode=='success' else 1),(mode,child.returncode,text)
   print('PASS '+mode+' hidden input, bounded exit, redaction, cleanup, no retry',flush=True)
  finally:
   if child.poll() is None:child.kill();child.wait()
   os.close(master);os.close(slave)
 print('CREATOR_INSTALLER_PTY_CASES=9')
