# Disposable relay claim contracts

No hosted target, network, real token or secret is accepted. Use the existing PostgreSQL 17 image with tmpfs, no published ports and networking disabled. Run the suites sequentially in a fresh container; do not overlap them or reuse the database for other tests.

```sh
docker run --rm --name creator-evidence-disposable --network none \
  --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=creator_test \
  -e POSTGRES_DB=glitch_creator_evidence_test -d postgres:17
docker exec creator-evidence-disposable pg_isready -U creator_test -d glitch_creator_evidence_test
# Wait for accepting connections before continuing.
python3 mvp/wallet-signal/tests/fixtures/creator-evidence/run-local.py
node mvp/wallet-signal/tests/fixtures/creator-evidence/run-adapter.mjs
docker stop creator-evidence-disposable
```

The SQL artifact has a disposable database-name guard, is outside migrations, and installs no production roles/policies. The Python fixture adds a synthetic NOLOGIN role/policies only inside the isolated database to test actual invoker permissions. Tests cover unique issuance/consumption/readback, independent connections, expiry after a lock wait, rollback and privilege denials. The JavaScript bridge exercises the actual parameterized claim adapter through local psql. It does not test a real Node database driver, hosted gateway, Storage RLS, or authentic evidence capture. No evidence rows or claims are copied from hosted storage.

For the synthetic-only profile, also run (in the same fresh disposable container):

```sh
python3 mvp/wallet-signal/tests/fixtures/creator-evidence/run-synthetic.py
node mvp/wallet-signal/tests/fixtures/creator-evidence/run-synthetic-adapter.mjs
```

The synthetic schema is separate. Its fixture substitutes synthetic UIDs, runs and short windows into the exact unapplied permission template. A minimal local `storage.objects`/`auth.uid()` fixture tests PostgreSQL RLS only; it is not Supabase Storage/Auth integration. No canonical historical object is used for synthetic hosted testing. All bytes here remain local.

Actual pinned `pg` runtime/TLS/SCRAM test (separate fresh container, automatically stopped):

```sh
python3 mvp/wallet-signal/tests/fixtures/creator-evidence/run-runtime.py
```

Run `npm ci --ignore-scripts` in the app first if dependencies are absent. The harness uses the installed Node binary and app directory as read-only binds, PostgreSQL data in tmpfs, no published ports and `--network none`. It generates only ephemeral local self-signed TLS fixtures and synthetic database passwords, never production credentials. It tests actual driver AbortSignal/query-timeout behavior, TLS/SCRAM, exact proposed invoker grants, concurrent claims, cancellation, committed-after-disconnect reconciliation, bounded handshake/query lifetime and full crypto/SQL composition with mocked Storage. It stops its container even on failure and refuses to reuse an existing container. No hosted endpoint or environment credential is accepted as input.
