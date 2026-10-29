"""No network: exact unapplied SQL in disposable PostgreSQL; never hosted."""
import subprocess,pathlib,time,json,concurrent.futures
root=pathlib.Path(__file__).resolve().parents[3];name='creator-server-session';db='glitch_creator_evidence_test'
assert subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0
subprocess.run(['docker','run','--rm','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER=creator_test','-e','POSTGRES_DB='+db,'-d','postgres:17'],check=True,stdout=subprocess.DEVNULL)
cmd=['docker','exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','creator_test','-d',db]
def sql(q,role=None,ok=True):
 c=cmd.copy()
 if role:c[c.index('-U')+1]=role
 r=subprocess.run(c,input=q,text=True,capture_output=True)
 if ok:assert r.returncode==0,r.stderr
 return r.stdout.strip() if ok else r
checks=0
def check(label,v):
 global checks
 assert v,label;checks+=1;print('PASS '+label,flush=True)
def arg(v):return "'"+json.dumps(v).replace("'","''")+"'::jsonb"
try:
 for _ in range(150):
  if subprocess.run(['docker','exec',name,'pg_isready','-U','creator_test','-d',db],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(.2)
 else:raise RuntimeError('startup timeout')
 sql((root/'docs/proposals/creator-evidence-closed-setup.sql').read_text())
 sql('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE postgres LOGIN NOSUPERUSER CREATEROLE CREATEDB BYPASSRLS INHERIT;ALTER SCHEMA creator_relay_test_private OWNER TO postgres;')
 sql('CREATE TABLE creator_relay_test_private.sealed_test_window(singleton boolean PRIMARY KEY,binding jsonb NOT NULL,closed_at timestamptz);ALTER TABLE creator_relay_test_private.sealed_test_window OWNER TO postgres;ALTER TABLE creator_relay_test_private.sealed_test_window ENABLE ROW LEVEL SECURITY;')
 # Synthetic existing role memberships supplied by closed setup, no new runtime grant.
 sql('ALTER ROLE creator_test_consumer_login CONNECTION LIMIT 20;ALTER ROLE creator_test_verifier_login CONNECTION LIMIT 20;')
 cmd[cmd.index('-U')+1]='postgres'
 sql('ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,authenticated,service_role;ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;')
 b=json.loads(subprocess.run(['node','--input-type=module','-e',"import {binding} from './tests/fixtures/creator-evidence/owner-auth-fixture.mjs'; console.log(JSON.stringify(binding(Math.floor(Date.now()/1000)-130)));"],cwd=root,capture_output=True,text=True,check=True).stdout)
 sql('INSERT INTO creator_relay_test_private.sealed_test_window VALUES(true,'+arg(b)+',NULL)')
 candidate=(root/'docs/proposals/creator-evidence-server-session.sql').read_text();sql(candidate)
 check('nonsuperuser exact candidate installs',sql("SELECT NOT rolsuper FROM pg_roles WHERE rolname=current_user")=='t')
 check('reinstall rolls back',sql(candidate,ok=False).returncode!=0)
 d=dict(target='preview',projectId=b['vercelProjectId'],id=b['deploymentId'],url=b['deploymentUrl'],commit=b['commit'],branch='fix/glitch-recovery-preflight-20261027')
 def call(p='upload',role='creator_test_consumer_login',override=None):
  r=dict(phase=p,binding=b,deployment=d);r.update(override or {})
  return sql('SELECT creator_relay_test_private.relay_auth_attempt('+arg(r)+')',role)
 for role in ['anon','authenticated','service_role','creator_test_issuer','creator_test_consumer','creator_test_verifier']:
  check(role+' no direct DML',sql("SELECT NOT has_table_privilege('"+role+"','creator_relay_test_private.auth_attempts','SELECT,INSERT,UPDATE,DELETE')")=='t')
 for role in ['anon','authenticated','service_role','creator_test_issuer']:
  check(role+' cannot invoke',sql("SELECT NOT has_function_privilege('"+role+"','creator_relay_test_private.relay_auth_attempt(jsonb)','EXECUTE')")=='t')
 check('wrong phase authority',call('readback')=='f')
 check('wrong installed binding',call(override={'binding':{**b,'commit':'b'*40}})=='f')
 check('wrong deployment',call(override={'deployment':{**d,'id':'dpl_other'}})=='f')
 original=json.loads(json.dumps(b))
 for label,start,end in [('before',int(time.time())+60,int(time.time())+120),('expired',int(time.time())-60,int(time.time())-1)]:
  b['upload']['startsAt']=start;b['upload']['expiresAt']=end
  sql('UPDATE creator_relay_test_private.sealed_test_window SET binding='+arg(b))
  check(label+' rejects',call()=='f')
 b=original;sql('UPDATE creator_relay_test_private.sealed_test_window SET binding='+arg(b))
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:r=list(pool.map(lambda _:call(),range(8)))
 check('eight concurrent connections one winner',r.count('t')==1 and r.count('f')==7)
 check('fresh connection replay rejected',call()=='f')
 sql('UPDATE creator_relay_test_private.sealed_test_window SET closed_at=clock_timestamp()')
 check('closeout rejects unconsumed readback',call('readback','creator_test_verifier_login')=='f')
 # Reopening is synthetic fixture manipulation only, not a runtime API.
 sql('UPDATE creator_relay_test_private.sealed_test_window SET closed_at=NULL')
 check('separate readback authority wins once',call('readback','creator_test_verifier_login')=='t')
 check('separate readback replay denied',call('readback','creator_test_verifier_login')=='f')
 check('permanent rows conservatively UNKNOWN',sql("SELECT count(*)=2 AND bool_and(outcome='UNKNOWN') FROM creator_relay_test_private.auth_attempts")=='t')
 for role in ['creator_test_consumer_login','creator_test_verifier_login']:
  check(role+' cannot release reservation',sql('DELETE FROM creator_relay_test_private.auth_attempts',role,False).returncode!=0)
 sql('UPDATE creator_relay_test_private.sealed_test_window SET closed_at=clock_timestamp()')
 check('closeout denies without deleting history',call()=='f' and sql('SELECT count(*) FROM creator_relay_test_private.auth_attempts')=='2')
 print('CREATOR_SERVER_SESSION_SQL_CHECKS='+str(checks))
finally:subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
