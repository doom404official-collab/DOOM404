# RI-68–RI-75 creator pipeline audit — 28 November 2026

Status: **Partially complete. Engineering corrections are regression verified; the mandatory independent live creator qualification remains open.** No claim of universal attribution, lifetime event completeness or production authorization is made.

## Reproducible defects and corrected stages

| Stage | Prior defect / limitation | Correction and acceptance evidence | Remaining limitation |
| --- | --- | --- | --- |
| Historical filtering | A receipt was accepted only when the mint was an instruction account key. Classic SPL `Transfer` omits the mint, despite exact mint metadata in token balances. This could discard relevant transfer receipts. | `creatorTransactionMentionsMint` also accepts a matching mint in valid SPL/Token-2022 balance metadata with a bounded account index and exact raw amount. Regression recovers a transfer without the mint key. | A balance-metadata match admits a transaction for decoding, not an ownership/event claim. |
| Historical decoding | The direct movement decoder rejected classic unchecked SPL transfers; the previous separate non-sale outflow decoder was narrowly Token-2022/6-decimal only. | A separate conservative classic SPL path verifies one outer token transfer, no CPI, supported programs only, unchanged source/destination ownership, creator boundary, signer authority and exact raw before/after changes. Incoming is `EXTERNAL_RECEIPT`; outgoing is `EXTERNAL_TRANSFER_OUT`. | Swaps, lifecycle changes, unknown CPI and fee discrepancies stay unverified. This correction does not convert transfers into purchases/sales. |
| Immutable reuse | The raw receipt cache used the same mint-account-key-only filter and dropped valid transfer receipts on subsequent scans. | Retrieval and reusable cache share balance-aware mint binding; regression verifies retained transfer reuse. | Existing bounded cache remains four raw transactions, at most 96 KB total. |
| Account pagination | A completed first account window was selected again on subsequent investigations; other verified current accounts could be starved. | Bound checkpoints retain completed targets and advance to the next verified account; no request budget increase. | A full page with a continuation cursor remains incomplete. Missing cursor metadata cannot certify exhaustion. |
| Historical/closed account discovery | Only current inventory and creation post-balances supplied targets; receipts showing later closed accounts could be lost as the four-receipt cache rotated. | Finalized before/after balance associations and finalized owner inventory produce bounded durable account association records: address, mint, owner, slot, signature, source and decoder version. Prior checkpoint association survives cache rotation. | Unknown closed accounts never appearing in retrieved receipts remain undiscovered. Account associations establish historical ownership observations, not current unrestricted ownership. At most256 associations retained. |
| Cache upgrade | Store invalidation pinned algorithm revision6; a corrected revision7 worker would otherwise continue reusing a completed revision6 observation until its normal expiry. | Pin/default revision7 expires only the exact completed older snapshot via updated-at CAS; retains immutable receipts; never expires active leases/current revision. Regression verifies old6 invalidation and retained receipts. | Dynamic refresh and historical archive completeness remain separate requirements. |
| Origin diagnosis | Rejected origin candidates yielded generic unsupported wording and no stage-level distinction. | `diagnoseBoundedCreatorOrigin` records candidate signature/slot and whether mint birth, initialization, signer requirement or supported protocol proof failed. | Without actual oldest indexed receipts, a decoder failure for a particular token cannot be claimed as reproduced. |
| Zero-event diagnostics | Total checked signatures included holder activity and was not evidence that creator history was decoded successfully. | Worker retains separate token-specific transaction count, account count, verified event count and indexed candidate/filter diagnostics. | Existing total `processedHistoricalSignatures` remains a total checked count for compatibility; token-specific fields must be used to judge relevant historical recovery. |

## Fixture root-cause matrix

Historical owner observations below are not permanent current token facts. The independent validation workstream resolves exact mints from retained scan records rather than ticker search.

| Fixture | Exact mint / retained observation | Earliest known failure stage | Current acceptance status |
| --- | --- | --- | --- |
| ANSEM | `9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump` | No verified creator role in the returned bounded earliest-candidate page; actual rejected original candidate receipt not retained by revision6. | Attribution remains unresolved; independent oldest transaction receipt needed. Do not infer identity from fee payer or49.23% holder. |
| Basket candidate (metadata confirmation required) | `3Tg6YnNrfPdFfsY14MaNsDMWLseAyrUDS3myJtbaJN6f`; retained22 processed signatures, zero current holdings; LaunchLab creator `5pZph7WVu66medeMT4Rq6eCPZmNBFkLEYACXjnZTpdwc` | Token-account page budget exhausted in retained investigation; zero events does not distinguish irrelevant records from decoder rejection without receipts. | Generic retrieval/transfer corrections verified; full live after-result pending. |
| DCTY | `9hjBLBrc7WZW2H8UQvBAvG5WiTZotXUv2Bdcn4f4pump`; retained19 signatures; creator `HCJLK3C1Mgke9Kxkz9fCZTebzuubPdmz8gx94gppkYXP` | Token-account page budget exhausted in retained investigation. Independent connector original transaction request rejected version1 under connector default version0. Application uses maxSupportedTransactionVersion1. | Connector limitation must not be reported as application defect; complete receipts/live after-result pending. |
| CATE | `Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump` | No verified protocol creator in bounded earliest page; revision6 did not retain rejected original candidates for per-stage independent decoding. | Attribution unresolved; creator must remain unassessed. |
| FLOAT | Previously verified Streamflow funding receipt and controls | Earlier acquisition unresolved; escrow sender must not be conflated with original creator. | Escrow/current control regression preserved within18 logical requests; no initial acquisition completion claim. |
| PAID | Prior verified event ledger | Continuous historical accounting/archival evidence remains incomplete. | Existing receipts and classifications preserved; no lifetime-history completion claim. |
| GTA6 / Super Inu / TRUMP | Existing fixture identities retained by integration validation | No new independently verified creator origin/history proof in this correction's focused run. | Mandatory live reinvestigation remains open. |

## Coverage integrity: exactly0% /60%

The current score weights creator current holdings at60% of the creator attribute and historical selling at40%. A verified current balance can assess the60% holding criterion, including an actual zero balance. Historical selling remains unassessed when complete lifetime/continuous-window evidence is unavailable; the bounded worker deliberately sets `historyComplete:false`. A successful API request, exhausted token-account page or recovered event does not certify that40% criterion. Therefore the60% plateau can be a legitimate criterion result, while repeat0% may be an attribution failure. Neither plateau proves that retrieval or decoding works. The new tests do not award higher coverage merely for returning events.

## Supported protocol/role matrix

| Mechanism | Creator attribution | Event scope | Unresolved scope |
| --- | --- | --- | --- |
| Pump.fun create / supported create_v2 layouts | Decoded protocol-assigned creator + successful local mint birth and initialization + required transaction signer; creator may differ from payer/user. | Existing proof-gated Pump acquisitions/sales; exact mint receipts/transfers/burns as supported. | Unknown layout variants and missing original transaction remain unassessed. |
| Raydium LaunchLab supported initialize / initializeV2 / Token-2022 layout | Pinned SDK protocol creator role, separate from payer and mint authority. | Existing initial distribution/settlement producers. | Unsupported variants or incomplete receipt cannot establish creator. |
| Direct SPL / Token-2022 mint | Mint initializer and mint authority may be observed; these are not automatically the economic creator. | Strict direct mint receipt and exact supported transfer paths. | General creator identity is not inferred from a fee payer, metadata authority or initial recipient. |
| Streamflow allocation funding | Verified funding sender and mint-bound escrow, independently from original creator. | Exact external funding transfer, local release controls and upgrade authority qualifications. | Earlier acquisition/economic custody, unsupported admin behavior and permanent code immutability. |
| Other launch mechanisms | Unassessed unless an existing explicit decoder establishes the role. | No generic incoming=purchase or outgoing=sale fallback. | Protocol-specific attribution and indexed archival recovery need evidence. |

## Historical provenance and continuation

Worker revision7 records `creator-token-history-v2-balance-mint-binding`, admitted finalized RPC source and immutable receipt revalidation. Account association records carry separate `creator-token-account-association-v1` provenance, source transaction signature/slot or finalized inventory slot. Creation receipts remain first in the bounded cache; transaction events retain signature/instruction identity and exact raw token units. Cursor checkpoints stay bound to mint, creator and target, detect repeated/cycling cursors, and never set lifetime history complete. Negative attribution is not saved as immutable creator proof.

## Focused verification

-26 history/account/transfer tests pass (existing19 + new7), including exact amounts above Number safe integer precision, unrelated mint isolation, ownership mutation, unauthorized signer, unknown swap context and balance mismatch rejection.
-20 combined cache/FLOAT/RI focused checks passed before the additional durable-association regression; current suite includes the new regression.
- Full creator-related suite is rerun after revision assertion update; integration owner records final counts.
- Live creator proof, complete accounting, supported mechanism independence and ten-second full-report performance remain acceptance gates. Test counts do not close them.
