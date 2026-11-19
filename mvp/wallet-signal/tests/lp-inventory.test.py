import unittest,importlib.util,sys,json,base64,tempfile,io,copy,signal,os,time,urllib.error
from unittest.mock import patch
from pathlib import Path
S=Path(__file__).resolve().parents[1]/'scripts'
sys.path.insert(0,str(S))
spec=importlib.util.spec_from_file_location('inv',S/'collect-lp-inventory.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
EP='https://solana-mainnet.g.alchemy.com/v2/SYNTHETIC_SECRET_42'
KEY=m.core.ADDRESSES[1]
def value(b):return {'owner':m.PROGRAM,'executable':False,'data':[base64.b64encode(b).decode(),'base64'],'space':len(b)}
def token():
 b=bytearray(165);b[:32]=m.core.base58(m.MINT,size=32);b[32:64]=m.core.base58(KEY,size=32);b[64:72]=(5).to_bytes(8,'little');b[108]=1;return b
def mint():
 b=bytearray(82);b[:4]=(1).to_bytes(4,'little');b[4:36]=m.core.base58(m.core.ADDRESSES[0],size=32);b[36:44]=(5).to_bytes(8,'little');b[44:46]=bytes([9,1]);return b
def env(i,rows,slot=10):return json.dumps({'jsonrpc':'2.0','id':i,'result':{'context':{'slot':slot},'value':rows}}).encode()
def selected(k=KEY,amount='5',decimals=9):return {'address':k,'amount':amount,'decimals':decimals,'uiAmount':None,'uiAmountString':'ignored'}
def selection():return [{'address':KEY,'amountRaw':'5','decimals':9,'providerReturnedPosition':1}]
def first():return env(1,[selected()])
def second():return env(2,[value(token()),value(mint())])
class Response(io.BytesIO):
 def __init__(self,b,status=200):super().__init__(b);self.headers={'Content-Length':str(len(b))};self.status=status
 def getcode(self):return self.status
class Checks(unittest.TestCase):
 def run_capture(self,responses):
  calls=[]
  def open_(req,timeout):
   calls.append(json.loads(req.data));r=responses[len(calls)-1]
   if isinstance(r,Exception):raise r
   return Response(r)
  with tempfile.TemporaryDirectory() as d:
   r=m.collect(EP,Path(d)/'capture',open_)
   public=Path(d)/'capture/public/projection.json'
   out=json.loads(public.read_bytes()) if public.exists() else None
  return r,calls,out
 def test_success_and_exact_bounds(self):
  r,c,o=self.run_capture([first(),second()]);self.assertEqual(r['attempts'],2);self.assertFalse(o['custodyVerified']);self.assertTrue(o['observedBalancesEqualMintSupply']);self.assertEqual(o['accounts'][0]['address'],KEY);self.assertNotIn('dataSize',json.dumps(c));self.assertEqual(c[1]['params'][0],[KEY,m.MINT]);self.assertEqual(c[1]['params'][1]['minContextSlot'],10)
 def test_bad_discovery_never_second(self):
  cases=[b'{',env(1,[selected()]*2),env(1,[] ,True),env(1,[{}]*100),b'{"jsonrpc":"2.0","id":1,"error":{}}',b' '* (m.MAX_BYTES+1)]
  for raw in cases:
   r,c,o=self.run_capture([raw]);self.assertEqual(len(c),1);self.assertIsNone(o)
 def test_account_rejections(self):
  for mutate in [lambda v:v.update(owner=m.core.CLASSIC),lambda v:v.update(executable=True),lambda v:v.update(space=True),lambda v:v.update(data=['!','base64'])]:
   v=value(token());mutate(v)
   with self.assertRaises(Exception):m.account(v)
  for offset,val in [(0,1),(108,0),(72,2),(109,1)]:
   b=token();b[offset]=val
   with self.assertRaises(Exception):m.account(value(b))
 def test_extensions(self):
  m.account(value(token()+bytes([2,7,0,0,0])))
  for suffix in [bytes([1]),bytes([2,8,0,0,0]),bytes([2,7,0,1,0,0]),bytes([2])+bytes(189)]:
   with self.assertRaises(Exception):m.account(value(token()+suffix))
 def test_second_failures_no_retry(self):
  for raw in [env(2,[value(token()),value(mint())],9),env(2,[None,value(mint())]),env(2,[]),b'{',RuntimeError(EP)]:
   r,c,o=self.run_capture([first(),raw]);self.assertEqual(len(c),2);self.assertIsNone(o);self.assertNotIn(EP,json.dumps(r))
 def test_transport_failures(self):
  r,c,o=self.run_capture([TimeoutError(EP)]);self.assertEqual(len(c),1);self.assertIsNone(o)
 def test_leaks_schema_valid_before_gate(self):
  ep='https://solana-mainnet.g.alchemy.com/v2/DEMO_ONLY'
  for secret in [b'DEMO_ONLY',base64.b64encode(b'DEMO_ONLY'),b'DEMO_ONLY'.hex().encode(),b'%44%45%4d%4f%5f%4f%4e%4c%59']:
   b=token();b[76:76+min(len(secret),32)]=secret[:32]
   m.account(value(b))
   raw=env(2,[value(b),value(mint())])
   with self.assertRaises(Exception):m.observation(raw,ep,10,[KEY],'a'*64,len(first()),selection())
 def test_endpoint_leak(self):
  obj=json.loads(first());obj['unused']=EP
  m.envelope(json.dumps(obj).encode(),1)
  with self.assertRaises(Exception):m.discovery(json.dumps(obj).encode(),EP)
 def test_zero_inventory_not_complete(self):
  z=mint();z[36:44]=bytes(8)
  r,c,o=self.run_capture([env(1,[]),env(2,[value(z)])]);self.assertEqual(len(c),2);self.assertFalse(o['inventoryCompletenessVerified'])
 def test_bool_id_duplicate_json(self):
  for b in [b'{"id":1,"id":1}',env(True,[])]:
   with self.assertRaises(Exception):m.envelope(b,1)

 def test_exact_requests(self):
  r,c,o=self.run_capture([first(),second()])
  self.assertEqual(c,[{'jsonrpc':'2.0','id':1,'method':'getTokenLargestAccounts','params':[m.MINT,{'commitment':'finalized'}]}, {'jsonrpc':'2.0','id':2,'method':'getMultipleAccounts','params':[[KEY,m.MINT],{'commitment':'finalized','encoding':'base64','minContextSlot':10}]}])
  self.assertEqual(r['attempts'],2)
 def test_20_21_boundary(self):
  keys=[m.key(i.to_bytes(32,'big')) for i in range(1,22)]
  for n in (20,21):
   rows=[selected(k) for k in keys[:n]]
   lp=mint();lp[36:44]=(5*n).to_bytes(8,'little')
   r,c,o=self.run_capture([env(1,rows),env(2,[value(token()) for _ in range(n)]+[value(lp)])])
   self.assertEqual(len(c),2 if n==20 else 1)
   if n==20:self.assertEqual(len(c[1]['params'][0]),21)
 def test_typed_fields_inactive_garbage_omitted(self):
  b=token();b[76:108]=bytes([77])*32;b[121:129]=(123).to_bytes(8,'little');b[133:165]=bytes([88])*32
  out=json.loads(m.observation(env(2,[value(b),value(mint())]),EP,10,[KEY],'a'*64,len(first()),selection()))
  row=out['accounts'][0];self.assertNotIn('delegate',row);self.assertNotIn('closeAuthority',row)
  b[72:76]=(1).to_bytes(4,'little');b[129:133]=(1).to_bytes(4,'little')
  out=json.loads(m.observation(env(2,[value(b),value(mint())]),EP,10,[KEY],'a'*64,len(first()),selection()))
  self.assertEqual(out['accounts'][0]['delegate'],{'authority':m.key(bytes([77])*32),'delegatedAmountRaw':'123'})
  self.assertEqual(out['accounts'][0]['closeAuthority'],m.key(bytes([88])*32))
  self.assertEqual(out['mintAccount']['supplyRaw'],'5')
 def test_equal_and_advancing_slots_never_complete(self):
  for slot in (10,11):
   o=json.loads(m.observation(env(2,[value(token()),value(mint())],slot),EP,10,[KEY],'a'*64,len(first()),selection()))
   for name in ('inventoryCompletenessVerified','crossSlotMembershipVerified','custodyVerified','scorePromoted'):self.assertIs(o[name],False)
 def test_mint_layout_failures(self):
  cases=[]
  for offset,val in [(0,0),(4,1),(44,8),(45,0),(46,1)]:
   b=mint();b[offset]=val;cases.append(b)
  cases.extend([mint()+bytes(84),mint()[:-1]])
  for b in cases:
   r,c,o=self.run_capture([first(),env(2,[value(token()),value(b)])]);self.assertEqual(len(c),2);self.assertIsNone(o)
 def transport_case(self,response):
  calls=[]
  def op(req,timeout):calls.append(req);return response
  with tempfile.TemporaryDirectory() as d:
   r=m.collect(EP,Path(d)/'cap',op)
   self.assertFalse((Path(d)/'cap/public/projection.json').exists())
  self.assertEqual(len(calls),1);self.assertEqual(r['status'],'STOP_RECONCILE_NO_RETRY');self.assertTrue(response.closed)
 def test_http_error_status(self):self.transport_case(Response(first(),503))
 def test_content_length_mismatch(self):
  r=Response(first());r.headers['Content-Length']='1';self.transport_case(r)
 def test_short_non_eof_read(self):
  class Short(Response):
   def read(self,n=-1):return super().read(min(n,10))
  self.transport_case(Short(first()))
 def test_short_eof_claimed_length(self):
  r=Response(first()[:-1]);r.headers['Content-Length']=str(len(first()));self.transport_case(r)
 def test_redirect_rejection(self):
  with self.assertRaises(Exception):m.core.NoRedirect().redirect_request(None,None,302,'',{},'https://example.invalid')
 def test_alarm_installed_invoked_and_restored(self):
  old=signal.getsignal(signal.SIGALRM);timers=[];calls=[]
  def op(req,timeout):
   calls.append(req);self.assertEqual(timeout,30)
   time.sleep(0.1) # real SIGALRM must interrupt this blocked synthetic transport
   self.fail('deadline did not interrupt')
  real=signal.setitimer
  def timer(which,value,*args):timers.append(value);return real(which,0.01 if value==30 else value,*args)
  with tempfile.TemporaryDirectory() as d,patch.object(signal,'setitimer',side_effect=timer):
   r=m.collect(EP,Path(d)/'cap',op)
  self.assertEqual(len(calls),1);self.assertIn(30,timers);self.assertEqual(timers[-1],0);self.assertEqual(signal.getsignal(signal.SIGALRM),old);self.assertEqual(signal.getitimer(signal.ITIMER_REAL)[0],0)
 def test_projection_failure_no_artifact(self):
  with patch.object(m,'observation',side_effect=RuntimeError(EP)):
   r,c,o=self.run_capture([first(),second()]);self.assertEqual(len(c),2);self.assertIsNone(o)
 def test_projected_fields_go_through_leak_gate(self):
  real=m.core.leakage_gate;seen=[]
  def gate(raw,obj,endpoint,binary):
   seen.append(obj)
   if obj.get('schema')=='LP_TOP20_AUTHORITY_V1':
    self.assertEqual(obj['accounts'][0]['amountRaw'],'5');self.assertEqual(obj['accounts'][0]['ownerAuthority'],KEY)
    raise m.core.Invalid('SYNTHETIC_PROJECTION_REJECTION')
   return real(raw,obj,endpoint,binary)
  with patch.object(m.core,'leakage_gate',side_effect=gate):
   r,c,o=self.run_capture([first(),second()]);self.assertIsNone(o)
  self.assertTrue(any(x.get('schema')=='LP_TOP20_AUTHORITY_V1' for x in seen))

 def test_http_exception(self):
  r,c,o=self.run_capture([urllib.error.HTTPError(EP,403,'private text',{},None)])
  self.assertEqual(len(c),1);self.assertIsNone(o);self.assertNotIn(EP,json.dumps(r))
 def test_body_deadline_closes_response(self):
  class Slow(Response):
   def read(self,n=-1):time.sleep(0.1);return super().read(n)
  real=signal.setitimer
  def timer(which,value,*args):return real(which,0.01 if value==30 else value,*args)
  with patch.object(signal,'setitimer',side_effect=timer):self.transport_case(Slow(first()))
  self.assertEqual(signal.getitimer(signal.ITIMER_REAL)[0],0)

 def test_inactive_workflow_contract(self):
  w=(S.parent/'docs/proposals/lp-inventory-workflow.yml').read_text()
  for text in ["on:\n  workflow_dispatch:","GITHUB_RUN_ATTEMPT']=='1'","GITHUB_SHA']==os.environ['REVIEWED_SHA']","GITHUB_REF']=='refs/heads/integration/glitch-app-main-20261118'",'default: false','contents: read','persist-credentials: false','retention-days: 1','scripts/collect-lp-inventory.py --approved-once','lp-inventory-private/public/projection.json','lp-inventory-private/public/manifest.json','actions/checkout@11d5960a326750d5838078e36cf38b85af677262','actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02']:
   self.assertIn(text,w)
  for text in ['always()','push:','pull_request:','schedule:','id-token:','response.bin']:
   self.assertNotIn(text,w)

 def test_diagnostic_discovery_categories(self):
  cases=[(b'{','JSON_DECODE'),(b'{"jsonrpc":"2.0","id":1,"error":{"message":"'+EP.encode()+b'"}}','RPC_ERROR'),(env(1,[],True),'RPC_ENVELOPE'),(env(1,[{}]*100),'DISCOVERY_COUNT'),(env(1,[{}]),'DISCOVERY_IDENTITY')]
  cases.append((env(1,[selected(amount='bad')]),'DISCOVERY_IDENTITY'))
  o=json.loads(first());o['ignored']=EP;cases.append((json.dumps(o).encode(),'DISCOVERY_LEAKAGE'))
  for raw,stage in cases:
   r,c,o=self.run_capture([raw]);self.assertEqual(r['failureStage'],stage);self.assertEqual(r['httpStatus'],200);self.assertIsNone(o);self.assertEqual(len(c),1);self.assertNotIn(EP,json.dumps(r))
 def test_diagnostic_transport_status_length(self):
  for response,stage,status in [(Response(first(),403),'HTTP_STATUS',403),(Response(first(),True),'HTTP_STATUS',None),(Response(first(),999),'HTTP_STATUS',None)]:
   with tempfile.TemporaryDirectory() as d:
    r=m.collect(EP,Path(d)/'cap',lambda *a,**k:response)
    self.assertEqual(r['failureStage'],stage);self.assertEqual(r['httpStatus'],status);self.assertFalse((Path(d)/'cap/public/projection.json').exists());self.assertTrue(response.closed)
  response=Response(first());response.headers['Content-Length']='1'
  with tempfile.TemporaryDirectory() as d:
   r=m.collect(EP,Path(d)/'cap',lambda *a,**k:response);self.assertEqual(r['failureStage'],'CONTENT_LENGTH')
 def test_diagnostic_second_stage_and_success(self):
  r,c,o=self.run_capture([first(),b'{']);self.assertEqual(r['failureStage'],'OBSERVATION_VALIDATION');self.assertEqual(r['attempts'],2);self.assertIsNone(o)
  r,c,o=self.run_capture([first(),second()]);self.assertEqual(r,{'status':'TYPED_CAPTURED_NOT_CUSTODY','attempts':2,'retries':0});self.assertFalse(o['custodyVerified'])
 def test_diagnostic_deadline_and_transport(self):
  r,c,o=self.run_capture([RuntimeError(EP)]);self.assertEqual(r['failureStage'],'TRANSPORT');self.assertIsNone(r['httpStatus']);self.assertNotIn(EP,json.dumps(r))
  real=signal.setitimer
  def timer(which,value,*a):return real(which,0.01 if value==30 else value,*a)
  def stall(*a,**k):time.sleep(.1);raise AssertionError()
  old=signal.getsignal(signal.SIGALRM)
  with tempfile.TemporaryDirectory() as d,patch.object(signal,'setitimer',side_effect=timer):
   r=m.collect(EP,Path(d)/'cap',stall);self.assertEqual(r['failureStage'],'DEADLINE');self.assertFalse((Path(d)/'cap/public/projection.json').exists())
  self.assertEqual(signal.getsignal(signal.SIGALRM),old);self.assertEqual(signal.getitimer(signal.ITIMER_REAL)[0],0)

 def test_top20_bad_selection_stops_before_second(self):
  for rows in [[selected(m.MINT)],[selected(),selected()],*[ [selected(amount=a)] for a in [True,5,-1,'-1','1.0','01','18446744073709551616','1e3',''] ],*[ [selected(decimals=d)] for d in [True,'9',8,None] ]]:
   r,c,o=self.run_capture([env(1,rows)]);self.assertEqual(len(c),1);self.assertIsNone(o)
 def test_top20_supply_and_discovery_remain_distinct(self):
  raw=env(1,[selected(amount='99')])
  r,c,o=self.run_capture([raw,env(2,[value(token()),value(mint())],11)])
  self.assertEqual(o['discoverySelection'][0]['amountRaw'],'99');self.assertEqual(o['accounts'][0]['amountRaw'],'5')
  self.assertEqual(o['observedSupplyFraction'],{'numeratorRaw':'5','denominatorRaw':'5'});self.assertFalse(o['crossSlotRankVerified']);self.assertFalse(o['inventoryCompletenessVerified'])
 def test_top20_zero_and_large_integer_fraction(self):
  for amount,supply in [(0,0),(0,1),(9007199254740993,18446744073709551615)]:
   b=token();b[64:72]=amount.to_bytes(8,'little');lp=mint();lp[36:44]=supply.to_bytes(8,'little')
   r,c,o=self.run_capture([env(1,[selected(amount=str(amount))]),env(2,[value(b),value(lp)])])
   self.assertEqual(o['observedBalanceSumRaw'],str(amount));self.assertEqual(o['mintSupplyRaw'],str(supply))
   self.assertEqual(o['observedSupplyFraction'],{'numeratorRaw':str(amount),'denominatorRaw':str(supply)} if supply else None)
   self.assertFalse(o['custodyVerified']);self.assertFalse(o['crossSlotRankVerified'])
 def test_top20_foreign_account_and_excess_supply(self):
  foreign=token();foreign[0]^=1
  excess=token();excess[64:72]=(6).to_bytes(8,'little')
  for b in [foreign,excess]:
   r,c,o=self.run_capture([first(),env(2,[value(b),value(mint())])]);self.assertEqual(len(c),2);self.assertIsNone(o)

 def test_same_slot_mismatch_rejected_advancing_allowed(self):
  for slot in (10,11):
   r,c,o=self.run_capture([env(1,[selected(amount='99')]),env(2,[value(token()),value(mint())],slot)])
   self.assertEqual(len(c),2)
   if slot==10:
    self.assertIsNone(o);self.assertEqual(r['failureStage'],'OBSERVATION_VALIDATION')
   else:
    self.assertEqual(o['discoverySelection'][0]['amountRaw'],'99');self.assertEqual(o['accounts'][0]['amountRaw'],'5')
    self.assertFalse(o['crossSlotRankVerified']);self.assertFalse(o['discoveryRankVerified'])
 def test_same_slot_matching_and_provider_order_only(self):
  other=m.core.ADDRESSES[2];b=token();b[64:72]=(6).to_bytes(8,'little');lp=mint();lp[36:44]=(11).to_bytes(8,'little')
  r,c,o=self.run_capture([env(1,[selected(),selected(other,'6')]),env(2,[value(token()),value(b),value(lp)])])
  self.assertEqual(r['status'],'TYPED_CAPTURED_NOT_CUSTODY')
  self.assertEqual(o['discoveryOrder'],'provider_returned_not_certified_rank');self.assertFalse(o['discoveryRankVerified'])
  self.assertEqual([x['providerReturnedPosition'] for x in o['discoverySelection']],[1,2])
  self.assertTrue(o['observedBalancesEqualMintSupply']);self.assertFalse(o['inventoryCompletenessVerified'])
if __name__=='__main__':unittest.main()
