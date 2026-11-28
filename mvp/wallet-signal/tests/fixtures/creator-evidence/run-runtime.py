"""Actual pg/TLS/SCRAM fixture. Never accepts a hosted target or real credential."""
import pathlib,subprocess,time,shutil,json
root=pathlib.Path(__file__).resolve().parents[3]
name='creator-evidence-runtime'
def run(args,**kw):return subprocess.run(args,check=True,**kw)
# Refuse to touch an existing container; caller must reconcile it first.
assert subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0
node=str(pathlib.Path(shutil.which('node')).resolve())
run(['docker','run','--rm','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','--mount',f'type=bind,source={root},target=/app,readonly','--mount',f'type=bind,source={node},target=/usr/local/bin/node,readonly','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER=creator_test','-e','POSTGRES_DB=glitch_creator_evidence_test','-d','postgres:17'],stdout=subprocess.DEVNULL)
try:
 for _ in range(50):
  if subprocess.run(['docker','exec',name,'pg_isready','-U','creator_test','-d','glitch_creator_evidence_test'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(.1)
 else:raise RuntimeError('local PostgreSQL not ready')
 def sql(q):run(['docker','exec','-i',name,'psql','-X','-v','ON_ERROR_STOP=1','-U','creator_test','-d','glitch_creator_evidence_test'],input=q,text=True,stdout=subprocess.DEVNULL)
 run(['docker','exec',name,'sh','-c',"openssl req -x509 -newkey rsa:2048 -nodes -keyout /var/lib/postgresql/data/runtime.key -out /var/lib/postgresql/data/runtime.crt -days 1 -subj /CN=localhost -addext subjectAltName=DNS:localhost >/dev/null 2>&1 && openssl req -x509 -newkey rsa:2048 -nodes -keyout /var/lib/postgresql/data/untrusted.key -out /var/lib/postgresql/data/untrusted.crt -days 1 -subj /CN=untrusted >/dev/null 2>&1 && chown postgres:postgres /var/lib/postgresql/data/*.key /var/lib/postgresql/data/*.crt && chmod 600 /var/lib/postgresql/data/*.key"])
 for q in ["ALTER SYSTEM SET ssl='on'","ALTER SYSTEM SET ssl_cert_file='runtime.crt'","ALTER SYSTEM SET ssl_key_file='runtime.key'","ALTER ROLE creator_test PASSWORD 'synthetic-only'"]:sql(q)
 run(['docker','exec',name,'sh','-c',"printf 'hostssl all all 127.0.0.1/32 scram-sha-256\nhostssl all all ::1/128 scram-sha-256\n' > /tmp/hba && cat /var/lib/postgresql/data/pg_hba.conf >> /tmp/hba && cat /tmp/hba > /var/lib/postgresql/data/pg_hba.conf"])
 sql('SELECT pg_reload_conf()')
 run(['docker','exec',name,'node','/app/tests/fixtures/creator-evidence/run-runtime.mjs'])
finally:
 run(['docker','stop',name],stdout=subprocess.DEVNULL)
