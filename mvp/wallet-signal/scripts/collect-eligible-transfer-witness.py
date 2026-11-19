"""Unpublished fixed priority-1 variant; no discovery or import-time network access."""
import importlib.util
import json
import os
from pathlib import Path
import sys

# Load a separate module instance: the original collector and fixture stay unchanged.
_spec = importlib.util.spec_from_file_location(
    'eligible_fixed_collector', Path(__file__).with_name('collect-fixed-transfer-witness.py'))
collector = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(collector)
collector.SIGNATURE = '5ZRFzrYTEKEeRdU7FPABcdfvkz2PxFdNQxt7ApTWDYNHfmBmPPRPotp5NYLAMMjaEnP4QxxKJnJSN5XqfgzG1K6G'
collector.SLOT = 450525312
collector.REQUEST = {'jsonrpc': '2.0', 'id': 1, 'method': 'getTransaction', 'params': [
    collector.SIGNATURE, {'commitment': 'finalized', 'encoding': 'json', 'maxSupportedTransactionVersion': 0}]}

def main():
    os.umask(0o077)
    if sys.argv[1:] != ['--approved-once']:
        print('{"status":"DISABLED","attempts":0}')
        return 0
    try:
        result = collector.collect(os.environ.get('ALCHEMY_SOLANA_ARCHIVE_RPC_URL'),
                                   'eligible-transfer-private')
        print(json.dumps(result))
        return 0 if result['status'] == 'CAPTURED_REQUIRES_INDEPENDENT_REVIEW' else 1
    except BaseException:
        print('{"status":"STOP_RECONCILE_NO_RETRY"}')
        return 1

if __name__ == '__main__':
    sys.exit(main())
