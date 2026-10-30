"""Linux PTY regression of the portable synthetic-only owner rehearsal."""
import os,pty,select,subprocess,pathlib,time,json,termios,re,sys
root=pathlib.Path(__file__).resolve().parents[3]
values=['SYNTHETIC_PASSWORD','sb_publishable_synthetic','doom404official@gmail.com','SYNTHETIC_PASSWORD','vijayananthrajkumar@gmail.com','SYNTHETIC_PASSWORD']
modes=['success','interrupt-prompt','eof-prompt','connection-error','connection-stall','read-stall','write-error','write-stall','interrupt-write','auth-error','auth-stall','interrupt-auth','reader-error','wrong-upload-email','swapped-upload-email','wrong-reader-email','swapped-reader-email']
if len(sys.argv)>1:
 assert all(mode in modes for mode in sys.argv[1:])
 modes=sys.argv[1:]
for mode in modes:
 entered=values.copy()
 if mode=='wrong-upload-email':entered[2]='other@example.invalid'
 if mode=='swapped-upload-email':entered[2]=values[4]
 if mode=='wrong-reader-email':entered[4]='other@example.invalid'
 if mode=='swapped-reader-email':entered[4]=values[2]
 master,slave=pty.openpty();before=termios.tcgetattr(slave)
 child=subprocess.Popen(['node',str(root/'tests/fixtures/creator-evidence/owner-installer-dryrun.mjs'),mode],stdin=slave,stdout=slave,stderr=slave,start_new_session=True)
 output=b'';sent=0;interrupted=False;deadline=time.monotonic()+18
 try:
  while child.poll() is None:
   if time.monotonic()>deadline:raise AssertionError('unbounded '+mode)
   if select.select([master],[],[],.05)[0]:output+=os.read(master,65536)
   prompts=output.count(b'(hidden): ')
   if mode in ['interrupt-prompt','eof-prompt'] and prompts and not interrupted:
    os.write(master,b'\x03' if mode=='interrupt-prompt' else b'\x04');interrupted=True
   elif mode not in ['interrupt-prompt','eof-prompt'] and prompts>sent:
    os.write(master,(entered[sent]+'\n').encode());sent+=1
   marker=b'SYNTHETIC_WRITE_PENDING' if mode=='interrupt-write' else b'SYNTHETIC_AUTH_PENDING'
   if mode in ['interrupt-write','interrupt-auth'] and marker in output and not interrupted:
    os.write(master,b'\x03');interrupted=True
  while select.select([master],[],[],.05)[0]:output+=os.read(master,65536)
  text=output.decode(errors='replace');lines=text.splitlines();ev=json.loads(next(x.split('=',1)[1] for x in lines if x.startswith('SYNTHETIC_EVENTS=')))
  # The instruction line intentionally names synthetic input; entered bytes must not echo.
  transcript='\n'.join(x for x in lines if not x.startswith('SYNTHETIC ONLY:'))
  assert all(s not in transcript for s in entered+['SYNTHETIC_SECRET_ERROR','SYNTHETIC_REFRESH_NEVER_RETAIN']),transcript
  assert not re.search(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',transcript),'token leaked'
  mask=termios.ECHO|termios.ICANON
  assert termios.tcgetattr(slave)[3]&mask==before[3]&mask,'terminal state not restored'
  writing=mode in ['success','write-error','write-stall','interrupt-write']
  autherror=mode in ['auth-error','auth-stall','interrupt-auth','reader-error','wrong-reader-email','swapped-reader-email']
  expected='DELIVERY_INSTALL_REPORTED_VERIFY_PRIVILEGES' if mode=='success' else 'INSTALL_OUTCOME_UNKNOWN_RECONCILE' if writing else 'AUTH_OUTCOME_RECONCILIATION_REQUIRED' if autherror else 'NOT_INSTALLED'
  assert expected in text,(mode,text,ev)
  if mode in ['wrong-upload-email','swapped-upload-email']:assert sent==3 and prompts==3,(mode,sent,prompts)
  if mode in ['wrong-reader-email','swapped-reader-email']:assert sent==5 and prompts==5,(mode,sent,prompts)
  assert ev.count('dispatch')==(1 if writing else 0),ev
  assert ev.count('auth')==(2 if writing or mode=='reader-error' else 1 if autherror else 0),ev
  if 'construct' in ev:assert 'destroy' in ev and 'end' in ev,ev
  assert child.returncode==(0 if mode=='success' else 1),(mode,child.returncode,text)
  print('PASS '+mode+' hidden input, bounded exit, redaction, memory handoff, no retry',flush=True)
 finally:
  if child.poll() is None:child.kill();child.wait()
  os.close(master);os.close(slave)
print('CREATOR_INSTALLER_PTY_CASES='+str(len(modes)))
