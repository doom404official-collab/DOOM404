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
assert sql("SELECT count(*) FROM pg_namespace WHERE nspname='creator_relay_test_private'")=='0'
root=pathlib.Path(__file__).resolve().parents[3]
sql((root/'docs/proposals/creator-evidence-synthetic-disposable.sql').read_text())
key='relay-tests/creator-auth-flow-v1.json'
def record():return dict(objectKey=key,capabilityHash='a'*64,payloadSha256='c902eeb22e2fc05e6378f0c578686d991c1cc70d72aeefa61dc7ae0ffe1343dd',issuedTokenHash='c'*64,byteLength=75,commit='d'*40,runId='123456',runAttempt='1',expiresAt=int(time.time())+240)
def arg(p):return "'"+json.dumps(p).replace("'","''")+"'::jsonb"
def reserve(p):return 'SELECT creator_relay_test_private.relay_reserve('+arg(p)+');'
def consume(p):return 'SELECT creator_relay_test_private.relay_consume('+arg(p)+') IS NOT NULL;'
def reset():sql('TRUNCATE creator_relay_test_private.relay_readbacks,creator_relay_test_private.relay_consumptions,creator_relay_test_private.relay_reservations;')
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
read='SELECT creator_relay_test_private.relay_readback('+arg(c)+','+str(int(time.time())+200)+') IS NOT NULL;'
check('readback has separate one-use claim',sorted(parallel([read,read]))==['f','t'])
reset();check('readback before upload rejected',sql(read)=='f')
check('expired issuance rejected',sql(reserve({**r,'expiresAt':int(time.time())-1}),False).returncode!=0)
check('wrong object rejected',sql(reserve({**r,'objectKey':'wrong'}),False).returncode!=0)
check('NULL reservation rejected',sql('SELECT creator_relay_test_private.relay_reserve(NULL)',False).returncode!=0)
check('rollback leaves no committed issuance',sql('BEGIN;'+reserve(r)+'ROLLBACK;'+reserve(r)).splitlines()[-1]=='t')
# A blocked INSERT must not authorize an expired capability after lock release.
reset();late=record();late['expiresAt']=int(time.time())+3;late_consume={**late,'tokenHash':'e'*64};sql(reserve(late))
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 first=pool.submit(sql,'BEGIN;'+consume(late_consume)+'SELECT pg_sleep(4);ROLLBACK;')
 time.sleep(.5)
 second=pool.submit(sql,consume(late_consume),False)
 first.result();result=second.result()
check('expiry while consume waits rolls back without durable use',result.returncode!=0 and 'RELAY_EXPIRED' in result.stderr and sql('SELECT count(*) FROM creator_relay_test_private.relay_consumptions')=='0')
reset();r=record();c={**r,'tokenHash':'e'*64};sql(reserve(r))
# Explicit synthetic roles/policies, only in this isolated database.
sql("CREATE ROLE synthetic_relay_fixture NOLOGIN; GRANT USAGE ON SCHEMA creator_relay_test_private TO synthetic_relay_fixture; GRANT EXECUTE ON FUNCTION creator_relay_test_private.relay_consume(jsonb) TO synthetic_relay_fixture; GRANT SELECT ON creator_relay_test_private.relay_reservations TO synthetic_relay_fixture; GRANT INSERT ON creator_relay_test_private.relay_consumptions TO synthetic_relay_fixture; CREATE POLICY fixture_read ON creator_relay_test_private.relay_reservations FOR SELECT TO synthetic_relay_fixture USING(true); CREATE POLICY fixture_insert ON creator_relay_test_private.relay_consumptions FOR INSERT TO synthetic_relay_fixture WITH CHECK(true);")
check('restricted invoker can consume with explicit tested privileges',sql('SET ROLE synthetic_relay_fixture;'+consume(c))=='t')
for q in ['UPDATE creator_relay_test_private.relay_reservations SET record=record','DELETE FROM creator_relay_test_private.relay_reservations','SELECT * FROM creator_relay_test_private.relay_consumptions']:
 check('restricted invoker denies '+q.split()[0],sql('SET ROLE synthetic_relay_fixture;'+q,False).returncode!=0)
check('PUBLIC has no function execution',sql("SELECT NOT EXISTS(SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) a WHERE p.oid='creator_relay_test_private.relay_consume(jsonb)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE')")=='t')
print(json.dumps(dict(passed=checks,hostedAccess=False,network=False)))
# Apply the exact proposed permissions with synthetic IDs/windows locally only.
# storage.objects/auth.uid are minimal fixtures, NOT hosted Storage API simulation.
import datetime
reset()
sql("CREATE SCHEMA storage; CREATE SCHEMA auth; CREATE ROLE authenticated NOLOGIN; CREATE TABLE storage.objects(bucket_id text NOT NULL,name text NOT NULL,PRIMARY KEY(bucket_id,name)); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA storage,auth TO authenticated; GRANT INSERT,SELECT ON storage.objects TO authenticated;")
upload='11111111-1111-4111-8111-111111111111';reader='22222222-2222-4222-8222-222222222222'
def stamp(offset):return datetime.datetime.fromtimestamp(time.time()+offset,datetime.timezone.utc).isoformat()
bindings={'UPLOAD_RUN':'123456','READ_RUN':'123457','SHA':'d'*40,'UPLOAD_UID':upload,'READ_UID':reader,'UPLOAD_START':stamp(-1),'UPLOAD_END':stamp(250),'READ_START':stamp(-1),'READ_END':stamp(250)}
template=(root/'docs/proposals/creator-evidence-synthetic-permissions.sql.in').read_text()
for k,v in bindings.items():template=template.replace('{{'+k+'}}',v)
assert '{{' not in template
guard=template.split('CREATE ROLE')[0]
check('template rejects same upload/read run',sql(guard.replace("'123457'","'123456'"),False).returncode!=0)
check('template rejects window longer than five minutes',sql(guard.replace(bindings['UPLOAD_END'],stamp(600)),False).returncode!=0)
check('template rejects same Storage identity',sql(guard.replace(reader,upload),False).returncode!=0)
sql(template)
r=record();c={**r,'tokenHash':'e'*64}
check('sealed issuer rejects another run',sql('SET ROLE creator_test_issuer;'+reserve({**r,'runId':'654321'}),False).returncode!=0)
check('fixed bytes hash enforced in private table',sql(reserve({**r,'payloadSha256':'b'*64}),False).returncode!=0)
check('issuer exact permissions permit one reservation',sql('SET ROLE creator_test_issuer;'+reserve(r))=='t')
check('consumer exact permissions permit one consumption',sql('SET ROLE creator_test_consumer;'+consume(c))=='t')
read='SELECT creator_relay_test_private.relay_readback('+arg(c)+','+str(int(time.time())+200)+') IS NOT NULL;'
check('verifier exact permissions permit readback',sql('SET ROLE creator_test_verifier;'+read)=='t')
check('issuer cannot execute readback',sql('SET ROLE creator_test_issuer;'+read,False).returncode!=0)
def authq(uid,q):return "SET ROLE authenticated; SET request.jwt.claim.sub='"+uid+"';"+q
insert="INSERT INTO storage.objects VALUES('creator-historical-evidence','"+key+"');"
check('uploader cannot insert historical path',sql(authq(upload,"INSERT INTO storage.objects VALUES('creator-historical-evidence','global/forbidden');"),False).returncode!=0)
check('reader cannot insert',sql(authq(reader,insert),False).returncode!=0)
check('uploader can insert fixed test object',sql(authq(upload,insert),False).returncode==0)
check('no overwrite: repeated insert conflicts',sql(authq(upload,insert),False).returncode!=0)
check('uploader cannot select stored object',sql(authq(upload,'SELECT count(*) FROM storage.objects'))=='0')
check('approved reader can select test object',sql(authq(reader,'SELECT count(*) FROM storage.objects'))=='1')
check('wrong identity cannot read',sql(authq('33333333-3333-4333-8333-333333333333','SELECT count(*) FROM storage.objects'))=='0')
for verb in ['UPDATE storage.objects SET name=name','DELETE FROM storage.objects']:
 check('no '+verb.split()[0]+' privilege',sql(authq(upload,verb),False).returncode!=0)
# A fresh expired-window policy denies even an otherwise valid authenticated UID.
sql("ALTER POLICY creator_test_object_read ON storage.objects USING (auth.uid()='"+reader+"'::uuid AND bucket_id='creator-historical-evidence' AND name='"+key+"' AND clock_timestamp()<'"+stamp(-1)+"'::timestamptz)")
check('expired read window denies existing object',sql(authq(reader,'SELECT count(*) FROM storage.objects'))=='0')
print(json.dumps(dict(passed=checks,hostedAccess=False,storageApiVerified=False)))
