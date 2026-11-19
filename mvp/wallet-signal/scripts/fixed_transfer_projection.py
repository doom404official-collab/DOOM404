"""Strict public evidence projection. Not an execution or signature verifier."""
import base64
import hashlib
import json
import re
import urllib.parse

ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
TOKEN2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'

class ProjectionRejected(Exception):
    pass

def require(value):
    if not value:
        raise ProjectionRejected()

def integer(value, maximum):
    require(type(value) is int and 0 <= value <= maximum)
    return value

def base58(value, size=None, maximum=1232):
    require(type(value) is str and 0 < len(value) <= maximum * 2)
    n = 0
    for c in value:
        require(c in ALPHABET)
        n = n * 58 + ALPHABET.index(c)
    raw = b'\0' * (len(value) - len(value.lstrip('1'))) + (n.to_bytes((n.bit_length()+7)//8, 'big') if n else b'')
    require(len(raw) <= maximum and (size is None or len(raw) == size))
    # Reject noncanonical leading-zero spellings by exact round trip.
    number = int.from_bytes(raw, 'big'); encoded = ''
    while number:
        number, remainder = divmod(number, 58); encoded = ALPHABET[remainder] + encoded
    require('1' * (len(raw)-len(raw.lstrip(b'\0'))) + encoded == value)
    return raw

def raw_amount(value):
    require(type(value) is str and re.fullmatch(r'0|[1-9][0-9]{0,19}', value) is not None)
    require(int(value) <= 2**64-1)
    return value

def leakage_gate(raw, obj, endpoint, binary_fields):
    # Defense in depth only: bounded common encodings, not universal detection.
    key = urllib.parse.urlsplit(endpoint).path.removeprefix('/v2/')
    require(len(key) >= 8)
    secrets = [endpoint.encode(), key.encode(), b'solana-mainnet.g.alchemy.com']
    variants = set(secrets)
    for secret in secrets:
        variants.update([base64.b64encode(secret), base64.urlsafe_b64encode(secret),
                         secret.hex().encode(), secret.hex().upper().encode(),
                         urllib.parse.quote_from_bytes(secret, safe='').encode()])
    def scan(data, depth=0):
        require(not any(v in data for v in variants))
        if depth == 2:
            return
        try:
            text = data.decode('ascii')
        except UnicodeDecodeError:
            return
        decoded = urllib.parse.unquote_to_bytes(text)
        if decoded != data:
            scan(decoded, depth+1)
        if len(text) <= 32768:
            if re.fullmatch(r'[0-9a-fA-F]+', text) and len(text)%2 == 0:
                scan(bytes.fromhex(text), depth+1)
            if re.fullmatch(r'[A-Za-z0-9_+/=-]+', text):
                try:
                    decoded = base64.b64decode(text + '='*((-len(text))%4), altchars=b'-_', validate=True)
                except Exception:
                    pass
                else:
                    scan(decoded, depth+1)
    scan(raw)
    def walk(value, depth=0):
        require(depth <= 32)
        if isinstance(value, str):scan(value.encode())
        elif isinstance(value, list):
            for item in value:walk(item,depth+1)
        elif isinstance(value, dict):
            for k,v in value.items():walk(k,depth+1);walk(v,depth+1)
    walk(obj)
    for value in binary_fields:scan(value)

def project(raw, obj, endpoint, signature, slot, mint):
    tx = obj['result']; msg = tx['transaction']['message']; meta = tx['meta']
    binary = [base58(signature,64)]
    keys = msg['accountKeys']; require(type(keys) is list and 0 < len(keys) <= 256)
    loaded = meta.get('loadedAddresses')
    if tx['version'] == 0: require(type(loaded) is dict)
    if loaded is None: loaded = {'writable':[], 'readonly':[]}
    require(type(loaded) is dict)
    for side in ['writable','readonly']:
        require(type(loaded.get(side)) is list)
    allkeys = keys + loaded['writable'] + loaded['readonly']
    require(0 < len(allkeys) <= 256 and len(set(allkeys)) == len(allkeys))
    for key in allkeys:binary.append(base58(key,32))
    require(mint in allkeys)
    header = msg.get('header');require(type(header) is dict)
    h = {k:integer(header.get(k),len(keys)) for k in ['numRequiredSignatures','numReadonlySignedAccounts','numReadonlyUnsignedAccounts']}
    require(0 < h['numRequiredSignatures'] <= len(keys))
    require(h['numReadonlySignedAccounts'] <= h['numRequiredSignatures'])
    require(h['numReadonlyUnsignedAccounts'] <= len(keys)-h['numRequiredSignatures'])
    signatures = tx['transaction']['signatures']
    require(len(signatures) == h['numRequiredSignatures'])
    for sig in signatures:binary.append(base58(sig,64))
    binary.append(base58(msg.get('recentBlockhash'),32))
    target = []
    def instruction(ix, outer, inner=None):
        require(type(ix) is dict)
        pid = integer(ix.get('programIdIndex'),len(allkeys)-1)
        accounts = ix.get('accounts');require(type(accounts) is list and len(accounts) <= 256)
        accounts = [integer(i,len(allkeys)-1) for i in accounts]
        data = ix.get('data');require(type(data) is str)
        decoded = base58(data) if data else b'';binary.append(decoded)
        out = {'programIdIndex':pid,'accounts':accounts,'data':data}
        if 'stackHeight' in ix:
            require(ix['stackHeight'] is None or type(ix['stackHeight']) is int and 0 <= ix['stackHeight'] <= 256)
            out['stackHeight'] = ix['stackHeight']
        if allkeys[pid] == TOKEN2022 and decoded[:1] == b'\x0c':
            require(len(decoded)==10 and len(accounts)>=4)
            if allkeys[accounts[1]] == mint:
                target.append({'outerIndex':outer,'innerIndex':inner})
        return out
    outer = msg['instructions'];require(type(outer) is list and 0 < len(outer) <= 1024)
    outer = [instruction(ix,i) for i,ix in enumerate(outer)]
    groups = meta['innerInstructions'];require(type(groups) is list and len(groups)<=len(outer))
    inner=[];seen=set()
    for group in groups:
        require(type(group) is dict)
        i=integer(group.get('index'),len(outer)-1);require(i not in seen);seen.add(i)
        require(type(group.get('instructions')) is list and len(group['instructions'])<=4096)
        inner.append({'index':i,'instructions':[instruction(ix,i,j) for j,ix in enumerate(group['instructions'])]})
    require(target)
    def balances(name):
        rows=meta[name];require(type(rows) is list and len(rows)<=256)
        out=[];seen=set()
        for row in rows:
            require(type(row) is dict)
            i=integer(row.get('accountIndex'),len(allkeys)-1);require(i not in seen);seen.add(i)
            binary.append(base58(row.get('mint'),32))
            amount=row.get('uiTokenAmount');require(type(amount) is dict)
            normalized={'accountIndex':i,'mint':row['mint'],'amountRaw':raw_amount(amount.get('amount')),'decimals':integer(amount.get('decimals'),255)}
            for field in ['owner','programId']:
                if field in row:
                    binary.append(base58(row[field],32));normalized[field]=row[field]
            out.append(normalized)
        return out
    pre=balances('preTokenBalances');post=balances('postTokenBalances')
    require(any(b['mint']==mint for b in pre+post))
    leakage_gate(raw,obj,endpoint,binary)
    projection={'schema':'FIXED_TRANSFER_PROJECTION_V1','signature':signature,'signatures':signatures,'slot':slot,'version':tx['version'],
        'commitmentRequested':'finalized','targetMint':mint,'executionError':None,
        'message':{'header':h,'accountKeys':keys,'recentBlockhash':msg['recentBlockhash'],'instructions':outer},
        'loadedAddresses':{'writable':loaded['writable'],'readonly':loaded['readonly']},
        'innerInstructions':inner,'preTokenBalances':pre,'postTokenBalances':post,'targetTransferPositions':target,
        'originalResponseSha256':hashlib.sha256(raw).hexdigest(),'originalResponseBytes':len(raw),
        'signatureCryptographicallyVerified':False,'transferBehaviorVerified':False,'settlementVerified':False,'scorePromoted':False}
    # Only explicitly constructed fields, no logs/errors/URLs or extra RPC fields.
    encoded=json.dumps(projection,sort_keys=True,separators=(',',':')).encode()
    leakage_gate(encoded,projection,endpoint,binary)
    return encoded
