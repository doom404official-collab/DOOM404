"""Linux PTY evidence only, not Windows ConsoleHost acceptance."""
import os,pty,subprocess,select,time,pathlib,sys,termios
pwsh=sys.argv[1];script=str(pathlib.Path(__file__).with_name('Test-MaskedPrompt.ps1'))
def run(cancel):
 master,slave=pty.openpty()
 p=subprocess.Popen([pwsh,'-NoLogo','-NoProfile','-File',script],stdin=slave,stdout=slave,stderr=slave,start_new_session=True)
 os.close(slave);out=b'';sent=False;deadline=time.monotonic()+12
 try:
  while time.monotonic()<deadline:
   if select.select([master],[],[],.1)[0]:
    try:
     chunk=os.read(master,8192);out+=chunk
     if b'\x1b[6n' in chunk:os.write(master,b'\x1b[1;1R')
    except OSError:break
   if not sent and b'SYNTHETIC MASKED PROMPT' in out and not (termios.tcgetattr(master)[3] & termios.ECHO):
    os.write(master,b'\x03' if cancel else b'SYNTHETIC_PRIVATE_32_CHAR_PASSWORD\r');sent=True
   if p.poll() is not None:break
  if p.poll() is None:
   try:p.wait(timeout=1)
   except subprocess.TimeoutExpired:p.kill();raise AssertionError('terminal stalled')
  assert sent
  assert b'SYNTHETIC_PRIVATE_32_CHAR_PASSWORD' not in out
  assert (b'LENGTH_ONLY=' in out) != cancel
 finally:
  if p.poll() is None:p.kill()
  p.wait();os.close(master)
 print('PASS masked prompt '+('Ctrl+C' if cancel else 'input'))
run(False);run(True)
