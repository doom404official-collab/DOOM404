# Creator password provisioning — local proposal, not yet approved for execution

Purpose: one owner-operated administrative password assignment for the TWO existing
GLITCH identities, followed by manual entry into narrowly scoped Vercel Secrets.
This is not a Scanner login screen, test run, new account flow or database-password
operation. No recovery email/redirect/reset page is required.

Fixed targets:
- Upload: `4b4d628a-d0cc-438e-bf04-661d1a5ea546`, `doom404official@gmail.com`.
- Readback: `3393dbd5-209f-4e3b-934d-57006fcdc4fa`, `vijayananthrajkumar@gmail.com`.
- Project: `acwmtobcbpkjfqiatyke` only.

## Owner steps after independent review and execution guidance

1. Use your personal Windows laptop and a private, unrecorded PowerShell console.
   Do not use the restricted work laptop, remote/screen-sharing session, PowerShell
   ISE, transcript, debug/verbose tracing or terminal recording. The entrypoint
   refuses configured transcription policy; it cannot detect every active recorder.
   If recording cannot be ruled out, stop. It does not disable policy or logging.
2. Obtain both reviewed files together: `Set-CreatorMachinePasswords.ps1` and
   `CreatorProvisioning.psm1`. Verify their review-provided SHA-256 hashes using
   `Get-FileHash`. Do not edit them or paste script text containing credentials.
3. Generate two DIFFERENT passwords in your password manager: 32–128 printable
   ASCII characters, no spaces. Save them under clearly separate upload/readback
   labels. The script asks for each twice but never prints/generated passwords.
4. Run the script WITHOUT the execution switch first. It must print DISABLED.
   Only when separately guided, the invocation is:
   `powershell.exe -NoProfile -File .\Set-CreatorMachinePasswords.ps1 -ExecuteApprovedProvisioning`
   There are no credential command-line arguments. Never use ExecutionPolicy Bypass,
   certificate bypass, or a policy change to make it run. If blocked, stop and report
   the non-secret error for a signing/distribution decision.
5. Confirm PRIVATE SESSION. For a genuinely first attempt choose FIRST RUN. Enter
   the approved modern Supabase `sb_secret_...` administrative key ONLY at the masked
   prompt. This is a broad project key: not a publishable key, database password,
   personal access token or legacy service-role JWT. There is no credential fallback.
   The utility uses it only in `apikey`, never Authorization, and never stores it.
6. Both exact identities are fetched and checked before any password prompt/update.
   Paste the saved upload password twice, then the saved readback password twice.
   Do not put credentials in chat. Do not use the browser console or shell history.
7. Record ONLY the printed non-secret outcomes. On UPDATE_OUTCOME_UNKNOWN, Ctrl+C,
   missing receipt, timeout, crash or unexpected termination: STOP. Do not rerun or
   sign in to probe. A read-only password-present flag cannot prove the new value.
   Obtain separate reconciliation guidance. Acknowledgement is an API response, not
   proof of a successful login. No session is created by this utility.
8. If upload is UPDATE_ACKNOWLEDGED and reader is definitively NOT_DISPATCHED,
   a separately reviewed continuation may choose READBACK ONLY AFTER UPLOAD
   ACKNOWLEDGED. It rechecks BOTH identities but never updates upload. Never use this
   mode after an uncertain reader update. There is no automatic resume/retry and no
   durable cross-invocation fence: operator adherence is required.
9. After both acknowledgements, enter the corresponding saved passwords directly in
   the Vercel dashboard as Secrets, Preview ONLY, branch
   `fix/glitch-recovery-preflight-20261027`, wallet-signal project ONLY:
   `CREATOR_MACHINE_UPLOAD_PASSWORD` and `CREATOR_MACHINE_READBACK_PASSWORD`.
   This storage step needs its own guided approval; the utility does not configure
   Vercel. The four existing `CREATOR_TEST_DB_*` variables remain separate/unchanged.
   `CREATOR_MACHINE_PUBLISHABLE_KEY` is separate non-secret configuration.
10. Close the child PowerShell process. Clear transient clipboard entries including
    history/sync copies where applicable. Do not rotate a shared administrative key
    automatically: that could disrupt other services. Session/key cleanup requires
    explicit review. No deployment or live upload/readback is included.

## Security and supported API

Official API: GET/PUT `https://acwmtobcbpkjfqiatyke.supabase.co/auth/v1/admin/users/{fixedUid}`.
PUT sends only `{password: ...}`. Official Supabase docs support admin password
assignment without the old password and modern secret keys in `apikey`:
- https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
- https://raw.githubusercontent.com/supabase/auth/master/openapi.yaml
- https://supabase.com/docs/guides/getting-started/api-keys

HTTP uses .NET HttpClient with default certificate/OS TLS validation, redirects,
cookies and default credentials disabled, 16 KiB response-header limit, 64 KiB body
limit and 15-second request/body deadline. No HTTP retry, sign-in, refresh, account
creation, database query, password-hash mutation or Storage operation exists. Every
PUT is marked UNKNOWN before transport and only exact successful identity response
changes it to ACKNOWLEDGED. Non-200 updates remain conservatively unknown.

The administrative key is NOT narrowed by the utility's allowlist. Local compromise
could expose broad project access. SecureString input is unmasked briefly in memory
for TLS headers/JSON; disposing objects/BSTRs is not a promise of complete managed
memory erasure. No values enter files, environment variables, logs or receipts by
this code. Forced external recording or memory inspection is outside that guarantee.

## Validation boundary

No Node/npm/pg/CLI installation is required on the owner's laptop. PowerShell 5.1
and .NET HttpClient-compatible APIs are targeted; script does not weaken Windows
execution policy. Actual Windows 5.1 ConsoleHost, Ctrl+C/finally behavior, OS TLS and
policy settings remain UNVERIFIED. No live key/account request has been made.

Synthetic tests use an injected core transport and private fake HttpMessageHandler;
no socket connects. Linux PowerShell parser/runtime and PTY tests are useful but do
not prove Windows compatibility. The terminal fixture is synthetic-only and makes
no imports/network calls; run its masked-input/cancellation rehearsal on Windows
before any real administrative credential. Review package source/hashes first.

Observed executor verification: official Linux PowerShell 7.4.22 tarball SHA-256
`9de443bef974f219c98a33b0f4096aace7f30b42188f37a1b14c5da7e82c8a6a`
matched the published release checksum. No runtime was installed on the owner laptop.
55 synthetic core/HTTP/parser checks passed, including 15-second noncooperative
header/body timeouts and chunked body limits. Two Linux PTY checks passed for masked
input and Ctrl+C. The PTY harness must wait until terminal echo is disabled before
injecting synthetic text; its initial readiness race was corrected. Neither the
Linux parser nor those terminal checks establishes Windows 5.1 compatibility.

For the owner Windows rehearsal, run ONLY the reviewed synthetic
`Test-MaskedPrompt.ps1` (which has no imports/network) with a clearly fake password,
then repeat and press Ctrl+C. It prints only length on success. Confirm no cleartext
input appears, cancellation exits, and a new console behaves normally. Run the
synthetic `Test-Provisioning.ps1` suite if its reviewed fixture/package is provided;
its transport is fake, and it does not authorize running the real entrypoint.
The test-only C# fixture uses modern .NET conveniences and may need test-harness
adaptation on Windows 5.1; do not change the production utility to weaken checks.

Application regression: 1,672 tests passed with network blocked; Next build and its
lint/type stage passed; evidence persistence remained SKIPPED_NOT_OPTED_IN. Existing
SQL/endpoint evidence is reused because this slice changes neither. Publication,
real key access/transmission and real provisioning remain pending parent review.
If no approved modern secret key is available, stop; this utility neither creates a
key nor falls back to a legacy JWT. Any alternative mode needs separate review.
