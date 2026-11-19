"""REVIEW ONLY: fixed current account capture; no import-time network access."""
import base64
import hashlib
import json
import os
import re
from pathlib import Path
import signal
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from fixed_transfer_projection import base58, leakage_gate as shared_leakage_gate

ADDRESSES = (
 '6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA',
 'F1Gw5qjivGuLcTsUBeq7ztzE4mi9uaDm7vQdz9sB9mp8',
 '78nPA3tUEH4b2jZjH1JKdqXjykYWzA7Az37CeKj1tTcg',
 'CWQgvR86mZPz5bmFGx8HF137yoqzMfGQWdFM1X7xhZ1G')
MINT = '98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump'
QUOTE = 'So11111111111111111111111111111111111111112'
POOL_PROGRAM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'
CLASSIC = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
TOKEN2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
MAX_BYTES = 65536
DEADLINE_SECONDS = 30
REQUEST = {'jsonrpc':'2.0','id':1,'method':'getMultipleAccounts',
 'params':[list(ADDRESSES),{'commitment':'finalized','encoding':'base64'}]}

class Invalid(Exception):
    pass

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Invalid('REDIRECT_REJECTED')

def now():
    return datetime.now(timezone.utc).isoformat()

def endpoint_valid(endpoint):
    if not isinstance(endpoint, str) or not endpoint.isascii() or any(c.isspace() for c in endpoint):
        return False
    try:
        u = urllib.parse.urlsplit(endpoint)
    except ValueError:
        return False
    key = u.path.removeprefix('/v2/')
    return (u.scheme == 'https' and u.netloc == 'solana-mainnet.g.alchemy.com' and
            u.path.startswith('/v2/') and 1 <= len(key) <= 256 and
            all(c.isalnum() or c in '_-' for c in key) and not u.query and not u.fragment)

def unique_object(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise Invalid('DUPLICATE_JSON_KEY')
        out[key] = value
    return out

def require(ok):
    if not ok:
        raise Invalid('ACCOUNT_EVIDENCE_REJECTED')

def leakage_gate(raw,obj,endpoint,binary_fields):
    # Preserve the reviewed gate, then handle percent sequences embedded in binary.
    shared_leakage_gate(raw,obj,endpoint,binary_fields)
    key=urllib.parse.urlsplit(endpoint).path.removeprefix('/v2/').encode()
    secrets=(endpoint.encode(),key,b'solana-mainnet.g.alchemy.com')
    variants=set(secrets)
    for value in secrets:
        variants.update((base64.b64encode(value),base64.urlsafe_b64encode(value),
                         value.hex().encode(),value.hex().upper().encode()))
    def scan(value):
        for _ in range(3):
            require(not any(v in value for v in variants))
            decoded=re.sub(rb'%([0-9a-fA-F]{2})',lambda m:bytes([int(m[1],16)]),value)
            if decoded==value: break
            value=decoded
    def walk(value):
        if isinstance(value,str):scan(value.encode())
        elif isinstance(value,list):
            for item in value:walk(item)
        elif isinstance(value,dict):
            for k,v in value.items():walk(k);walk(v)
    scan(raw);walk(obj)
    for value in binary_fields:scan(value)

def decode(raw):
    obj=json.loads(raw.decode('utf-8'),object_pairs_hook=unique_object,
        parse_constant=lambda _: (_ for _ in ()).throw(Invalid('NONFINITE_JSON')))
    require(isinstance(obj,dict) and obj.get('jsonrpc')=='2.0' and type(obj.get('id')) is int and obj['id']==1 and 'error' not in obj)
    result=obj.get('result'); require(isinstance(result,dict))
    context=result.get('context'); require(isinstance(context,dict))
    slot=context.get('slot'); require(type(slot) is int and 0<slot<=2**53-1)
    values=result.get('value'); require(isinstance(values,list) and len(values)==4)
    binary=[]; accounts=[]
    for address,v in zip(ADDRESSES,values):
        require(isinstance(v,dict) and v.get('executable') is False)
        owner=v.get('owner'); base58(owner,size=32)
        data=v.get('data'); require(isinstance(data,list) and len(data)==2 and data[1]=='base64' and isinstance(data[0],str))
        b=base64.b64decode(data[0],validate=True)
        require(base64.b64encode(b).decode()==data[0] and 0<len(b)<=4096)
        require('space' not in v or type(v['space']) is int and v['space']==len(b))
        binary.append(b)
        accounts.append({'address':address,'owner':owner,'executable':False,'dataBytes':len(b),'dataSha256':hashlib.sha256(b).hexdigest()})
    p,b,q,lp=binary
    require(accounts[0]['owner']==POOL_PROGRAM and len(p)>=243 and p[:8]==bytes([241,154,109,4,17,177,109,188]))
    for offset,key in ((43,MINT),(75,QUOTE),(107,ADDRESSES[3]),(139,ADDRESSES[1]),(171,ADDRESSES[2])):
        require(p[offset:offset+32]==base58(key,size=32))
    for i,token,mint in ((1,b,MINT),(2,q,QUOTE)):
        require(accounts[i]['owner'] in (CLASSIC,TOKEN2022) and len(token)>=165)
        require(token[:32]==base58(mint,size=32) and token[32:64]==base58(ADDRESSES[0],size=32) and token[108]==1)
        # Base Account::LEN is valid for either token program. Extended Token-2022
        # accounts require the account discriminator; extension semantics stay Unknown.
        require(all(int.from_bytes(token[o:o+4],'little') in (0,1) for o in (72,109,129)))
        if accounts[i]['owner']==CLASSIC:
            require(len(token)==165)
        elif len(token)>165:
            require(len(token)!=355 and token[165]==2)
        accounts[i]['extensionSemanticsVerified']=False
        accounts[i]['unparsedSuffixBytes']=max(0,len(token)-166)
    require(accounts[3]['owner'] in (CLASSIC,TOKEN2022) and len(lp)>=82 and lp[45]==1)
    if accounts[3]['owner']==CLASSIC:
        require(len(lp)==82)
    elif len(lp)>82:
        require(len(lp)>=166 and len(lp)!=355 and lp[82:165]==bytes(83) and lp[165]==1)
    accounts[0]['unparsedSuffixBytes']=len(p)-243
    accounts[0]['completeLayoutValidated']=False
    accounts[3]['unparsedSuffixBytes']=max(0,len(lp)-166)
    accounts[3]['extensionSemanticsVerified']=False
    require(int.from_bytes(lp[:4],'little') in (0,1) and int.from_bytes(lp[46:50],'little') in (0,1))
    accounts[0]['decoded']={'discriminatorHex':p[:8].hex(),'baseMint':MINT,'quoteMint':QUOTE,'lpMint':ADDRESSES[3],'baseVault':ADDRESSES[1],'quoteVault':ADDRESSES[2],'poolReportedLpSupplyRaw':str(int.from_bytes(p[203:211],'little'))}
    for i,token,mint in ((1,b,MINT),(2,q,QUOTE)):
        accounts[i]['decoded']={'mint':mint,'authority':ADDRESSES[0],'amountRaw':str(int.from_bytes(token[64:72],'little')),'state':1}
    # Authorities are public keys, not arbitrary string fields from the provider.
    alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    def key(data):
        n=int.from_bytes(data,'big'); out=''
        while n: n,r=divmod(n,58); out=alphabet[r]+out
        return '1'*(len(data)-len(data.lstrip(b'\0')))+out
    accounts[3]['decoded']={'supplyRaw':str(int.from_bytes(lp[36:44],'little')),'decimals':lp[44],'initialized':True,
      'mintAuthority':key(lp[4:36]) if int.from_bytes(lp[:4],'little') else None,
      'freezeAuthority':key(lp[50:82]) if int.from_bytes(lp[46:50],'little') else None}
    return obj,slot,accounts,binary

def validate(raw):
    _,slot,_,_=decode(raw)
    return {'contextSlot':slot,'currentAccountObservationOnly':True,'validationScope':'core_identity_and_base_fields_only','scorePromoted':False}

def project(raw,obj,endpoint,*unused):
    obj,slot,accounts,binary=decode(raw)
    leakage_gate(raw,obj,endpoint,binary)
    projection={'schema':'FIXED_POOL_ACCOUNT_PROJECTION_V1','commitmentRequested':'finalized',
      'validationScope':'core_identity_and_base_fields_only','completeAccountSemanticsVerified':False,
      'contextSlot':slot,'accountBytesIncluded':False,'accounts':accounts,'originalResponseBytes':len(raw),
      'originalResponseSha256':hashlib.sha256(raw).hexdigest(),
      'historicalAuthorizationVerified':False,'custodyVerified':False,'withdrawalSafetyVerified':False,'scorePromoted':False}
    encoded=json.dumps(projection,sort_keys=True,separators=(',',':')).encode()
    leakage_gate(encoded,projection,endpoint,binary)
    return encoded

def collect(endpoint, directory, opener=None):
    # Exclusive directory is a local replay guard; Actions reruns remain separately forbidden.
    if not endpoint_valid(endpoint):
        return {'status': 'REJECTED_CONFIGURATION', 'attempts': 0}
    directory = Path(directory)
    directory.mkdir(mode=0o700, parents=False, exist_ok=False)
    receipt = {'status': 'PREPARED', 'attempts': 0, 'provider': 'Alchemy Solana mainnet',
               'startedAt': now(), 'maximumBytes': MAX_BYTES, 'nominalCU': 20,
               'actualBillingVerified': False, 'retries': 0}
    def save():
        with os.fdopen(os.open(directory / 'receipt.json', os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600), 'w', encoding='utf-8') as f:
            json.dump(receipt, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
    save()
    old = signal.getsignal(signal.SIGALRM)
    def timeout(_signum, _frame):
        raise Invalid('DEADLINE_EXCEEDED')
    signal.signal(signal.SIGALRM, timeout)
    response = None
    digest = hashlib.sha256()
    count = 0
    try:
        request = urllib.request.Request(endpoint, data=json.dumps(REQUEST).encode(), headers={'Content-Type': 'application/json', 'Accept-Encoding': 'identity'}, method='POST')
        # Durable intent before dispatch. Never resume or retry an ambiguous attempt.
        receipt.update(status='DISPATCH_INTENT', attempts=1)
        save()
        signal.setitimer(signal.ITIMER_REAL, DEADLINE_SECONDS)
        transport = opener or urllib.request.build_opener(NoRedirect()).open
        try:
            response = transport(request, timeout=DEADLINE_SECONDS)
        except urllib.error.HTTPError as error:
            response = error
        with os.fdopen(os.open(directory / 'response.bin', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'wb') as out:
            while True:
                chunk = response.read(min(65536, MAX_BYTES + 1 - count))
                if not chunk:
                    break
                out.write(chunk)
                digest.update(chunk)
                count += len(chunk)
                if count > MAX_BYTES:
                    raise Invalid('RESPONSE_TOO_LARGE')
            out.flush()
            os.fsync(out.fileno())
        receipt.update(responseBytes=count, responseSha256=digest.hexdigest())
        length = response.headers.get('Content-Length')
        if length is not None and (not length.isdecimal() or int(length) != count):
            raise Invalid('CONTENT_LENGTH_MISMATCH')
        if response.getcode() != 200:
            raise Invalid('HTTP_REJECTED')
        # Complete saved bytes, never a projected/truncated connector string.
        raw = (directory / 'response.bin').read_bytes()
        receipt['observation'] = validate(raw)
        projection = project(raw, json.loads(raw), endpoint)
        public = directory / 'public'
        public.mkdir(mode=0o700, exist_ok=False)
        with os.fdopen(os.open(public / 'projection.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'wb') as f:
            f.write(projection); f.flush(); os.fsync(f.fileno())
        manifest = {'schema': 'FIXED_POOL_ACCOUNT_MANIFEST_V1', 'originalResponseSha256': digest.hexdigest(), 'originalResponseBytes': count, 'projectionSha256': hashlib.sha256(projection).hexdigest(), 'projectionBytes': len(projection), 'originalResponseIncluded': False}
        with os.fdopen(os.open(public / 'manifest.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'w') as f:
            json.dump(manifest, f, sort_keys=True); f.flush(); os.fsync(f.fileno())
        receipt.update(status='CAPTURED_REQUIRES_INDEPENDENT_REVIEW', responseComplete=True)
    except BaseException:
        # Exception strings may contain endpoint credentials or response fragments.
        receipt.update(status='STOP_RECONCILE_NO_RETRY', responseComplete=False,
                       retainedBytes=count, retainedSha256=digest.hexdigest())
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old)
        if response is not None:
            try:
                response.close()
            except BaseException:
                receipt['status'] = 'STOP_RECONCILE_NO_RETRY'
        if receipt['status'] != 'CAPTURED_REQUIRES_INDEPENDENT_REVIEW':
            # Only files created within this exclusive invocation directory.
            public = directory / 'public'
            if public.is_symlink():
                public.unlink()
            elif public.is_dir():
                for name in ('projection.json', 'manifest.json'):
                    path = public / name
                    if path.exists() or path.is_symlink():
                        path.unlink()
            raw_path = directory / 'response.bin'
            if raw_path.exists():
                raw_path.unlink()
        receipt['endedAt'] = now()
        save()
    return receipt

def main():
    os.umask(0o077)
    if sys.argv[1:] != ['--approved-once']:
        print('{"status":"DISABLED","attempts":0}')
        return 0
    try:
        result = collect(os.environ.get('ALCHEMY_SOLANA_ARCHIVE_RPC_URL'), 'fixed-pool-private')
        print(json.dumps(result))
        return 0 if result['status'] == 'CAPTURED_REQUIRES_INDEPENDENT_REVIEW' else 1
    except BaseException:
        print('{"status":"STOP_RECONCILE_NO_RETRY"}')
        return 1

if __name__ == '__main__':
    sys.exit(main())
