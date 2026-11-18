"""Inactive one-request collector. CLI requires explicit approval; no imports do I/O."""
from fixed_transfer_projection import project
import hashlib
import json
import os
from pathlib import Path
import signal
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

SIGNATURE = '37WZYkLnwzcPmYdoydTRhYAoUAcFGwHYem3QGt6exoSqt8H2SCZZuB5uUZg3Dd9NyTjYr62nhaxT2VbMELDKocA6'
MINT = '98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump'
SLOT = 450097547
MAX_BYTES = 2 * 1024 * 1024
DEADLINE_SECONDS = 30
REQUEST = {'jsonrpc': '2.0', 'id': 1, 'method': 'getTransaction', 'params': [SIGNATURE, {'commitment': 'finalized', 'encoding': 'json', 'maxSupportedTransactionVersion': 0}]}

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

def validate(raw):
    obj = json.loads(raw.decode('utf-8'), object_pairs_hook=unique_object,
                     parse_constant=lambda _: (_ for _ in ()).throw(Invalid('NONFINITE_JSON')))
    if not isinstance(obj, dict) or obj.get('jsonrpc') != '2.0' or type(obj.get('id')) is not int or obj['id'] != 1 or 'error' in obj:
        raise Invalid('RPC_ENVELOPE_REJECTED')
    tx = obj.get('result')
    if not isinstance(tx, dict) or type(tx.get('slot')) is not int or tx['slot'] != SLOT:
        raise Invalid('SLOT_REJECTED')
    version = tx.get('version')
    if not (version == 'legacy' or type(version) is int and version == 0):
        raise Invalid('VERSION_REJECTED')
    transaction = tx.get('transaction')
    if not isinstance(transaction, dict) or not isinstance(transaction.get('signatures'), list) or not transaction['signatures'] or transaction['signatures'][0] != SIGNATURE:
        raise Invalid('SIGNATURE_REJECTED')
    meta = tx.get('meta')
    if not isinstance(meta, dict) or 'err' not in meta or meta['err'] is not None:
        raise Invalid('EXECUTION_UNVERIFIED')
    message = transaction.get('message')
    if not isinstance(message, dict) or not isinstance(message.get('accountKeys'), list) or not isinstance(message.get('instructions'), list):
        raise Invalid('MESSAGE_INCOMPLETE')
    if not all(isinstance(meta.get(k), list) for k in ('innerInstructions', 'preTokenBalances', 'postTokenBalances')):
        raise Invalid('METADATA_INCOMPLETE')
    loaded = meta.get('loadedAddresses', {'writable': [], 'readonly': []})
    if not isinstance(loaded, dict) or not all(isinstance(loaded.get(k), list) for k in ('writable', 'readonly')):
        raise Invalid('LOADED_KEYS_INCOMPLETE')
    keys = message['accountKeys'] + loaded['writable'] + loaded['readonly']
    if not all(isinstance(k, str) for k in keys) or MINT not in keys:
        raise Invalid('TARGET_MINT_UNREFERENCED')
    return {'slot': SLOT, 'version': version, 'targetMintReferenced': True,
            'executionErrorReported': False, 'transferBehaviorVerified': False,
            'settlementVerified': False, 'scorePromoted': False}

def collect(endpoint, directory, opener=None):
    # Exclusive directory is a local replay guard; Actions reruns remain separately forbidden.
    if not endpoint_valid(endpoint):
        return {'status': 'REJECTED_CONFIGURATION', 'attempts': 0}
    directory = Path(directory)
    directory.mkdir(mode=0o700, parents=False, exist_ok=False)
    receipt = {'status': 'PREPARED', 'attempts': 0, 'provider': 'Alchemy Solana mainnet',
               'startedAt': now(), 'maximumBytes': MAX_BYTES, 'nominalCU': 40,
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
        projection = project(raw, json.loads(raw), endpoint, SIGNATURE, SLOT, MINT)
        public = directory / 'public'
        public.mkdir(mode=0o700, exist_ok=False)
        with os.fdopen(os.open(public / 'projection.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'wb') as f:
            f.write(projection); f.flush(); os.fsync(f.fileno())
        manifest = {'schema': 'FIXED_TRANSFER_PROJECTION_MANIFEST_V1', 'originalResponseSha256': digest.hexdigest(), 'originalResponseBytes': count, 'projectionSha256': hashlib.sha256(projection).hexdigest(), 'projectionBytes': len(projection), 'originalResponseIncluded': False}
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
        result = collect(os.environ.get('ALCHEMY_SOLANA_ARCHIVE_RPC_URL'), 'fixed-transfer-private')
        print(json.dumps(result))
        return 0 if result['status'] == 'CAPTURED_REQUIRES_INDEPENDENT_REVIEW' else 1
    except BaseException:
        print('{"status":"STOP_RECONCILE_NO_RETRY"}')
        return 1

if __name__ == '__main__':
    sys.exit(main())
