"""Disposable PostgreSQL only; no remote URI, hosted keys or network accepted."""
import subprocess,json,pathlib,concurrent.futures,time
container='creator-evidence-disposable';db='glitch_creator_evidence_test'
info=json.loads(subprocess.check_output(['docker','inspect',container],text=True))[0]
assert info['HostConfig']['NetworkMode']=='none' and info['Config']['Image']=='postgres:17'
assert all(m['Type']=='tmpfs' for m in info['Mounts'])
cmd=['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','creator_test','-d',db]
def sql(q,ok=True):
 r=subprocess.run(cmd,input=q,text=True,capture_output=True)
 if ok:assert r.returncode==0,r.stderr
 return r.stdout.strip() if ok else r
assert sql('SELECT current_database()')==db
assert sql("SELECT count(*) FROM pg_namespace WHERE nspname='creator_private'")=='0'
root=pathlib.Path(__file__).resolve().parents[3]
sql((root/'docs/proposals/creator-evidence-relay-disposable.sql').read_text())
key='global/442809233/4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf/9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30.json'
def record():return dict(objectKey=key,capabilityHash='a'*64,payloadSha256='b'*64,issuedTokenHash='c'*64,byteLength=42,commit='d'*40,runId='123456',runAttempt='1',expiresAt=int(time.time())+240)
def arg(p):return "'"+json.dumps(p).replace("'","''")+"'::jsonb"
def reserve(p):return 'SELECT creator_private.relay_reserve('+arg(p)+');'
def consume(p):return 'SELECT creator_private.relay_consume('+arg(p)+') IS NOT NULL;'
def reset():sql('TRUNCATE creator_private.relay_readbacks,creator_private.relay_consumptions,creator_private.relay_reservations;')
checks=0
def check(name,condition):
 global checks
 assert condition,name;checks+=1;print('PASS',name,flush=True)
def parallel(qs):
 with concurrent.futures.ThreadPoolExecutor(2) as p:return list(p.map(sql,qs))
r=record();check('one durable reservation across connections',sorted(parallel([reserve(r),reserve(r)]))==['f','t'])
c={**r,'tokenHash':'e'*64};check('wrong capability cannot consume',sql(consume({**c,'capabilityHash':'f'*64}))=='f')
check('one durable consumption across connections',sorted(parallel([consume(c),consume(c)]))==['f','t'])
check('fresh connection cannot replay consumed upload',sql(consume(c))=='f')
read='SELECT creator_private.relay_readback('+arg(c)+','+str(int(time.time())+200)+') IS NOT NULL;'
check('readback has separate one-use claim',sorted(parallel([read,read]))==['f','t'])
reset();check('readback before upload rejected',sql(read)=='f')
check('expired issuance rejected',sql(reserve({**r,'expiresAt':int(time.time())-1}),False).returncode!=0)
check('wrong object rejected',sql(reserve({**r,'objectKey':'wrong'}),False).returncode!=0)
check('NULL reservation rejected',sql('SELECT creator_private.relay_reserve(NULL)',False).returncode!=0)
check('rollback leaves no committed issuance',sql('BEGIN;'+reserve(r)+'ROLLBACK;'+reserve(r)).splitlines()[-1]=='t')
# A blocked INSERT must not authorize an expired capability after lock release.
reset();late=record();late['expiresAt']=int(time.time())+3;late_consume={**late,'tokenHash':'e'*64};sql(reserve(late))
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 first=pool.submit(sql,'BEGIN;'+consume(late_consume)+'SELECT pg_sleep(4);ROLLBACK;')
 time.sleep(.5)
 second=pool.submit(sql,consume(late_consume),False)
 first.result();result=second.result()
check('expiry while consume waits rolls back without durable use',result.returncode!=0 and 'RELAY_EXPIRED' in result.stderr and sql('SELECT count(*) FROM creator_private.relay_consumptions')=='0')
reset();r=record();c={**r,'tokenHash':'e'*64};sql(reserve(r))
# Explicit synthetic roles/policies, only in this isolated database.
sql("CREATE ROLE relay_fixture NOLOGIN; GRANT USAGE ON SCHEMA creator_private TO relay_fixture; GRANT EXECUTE ON FUNCTION creator_private.relay_consume(jsonb) TO relay_fixture; GRANT SELECT ON creator_private.relay_reservations TO relay_fixture; GRANT INSERT ON creator_private.relay_consumptions TO relay_fixture; CREATE POLICY fixture_read ON creator_private.relay_reservations FOR SELECT TO relay_fixture USING(true); CREATE POLICY fixture_insert ON creator_private.relay_consumptions FOR INSERT TO relay_fixture WITH CHECK(true);")
check('restricted invoker can consume with explicit tested privileges',sql('SET ROLE relay_fixture;'+consume(c))=='t')
for q in ['UPDATE creator_private.relay_reservations SET record=record','DELETE FROM creator_private.relay_reservations','SELECT * FROM creator_private.relay_consumptions']:
 check('restricted invoker denies '+q.split()[0],sql('SET ROLE relay_fixture;'+q,False).returncode!=0)
check('PUBLIC has no function execution',sql("SELECT NOT EXISTS(SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) a WHERE p.oid='creator_private.relay_consume(jsonb)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE')")=='t')
print(json.dumps(dict(passed=checks,hostedAccess=False,network=False)))
