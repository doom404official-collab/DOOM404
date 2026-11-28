# WP-03 allocation/control qualification

Baseline: 265359e477cc14e4e4aeae0556066f1fcf3818ac. This document covers implemented, evidence-bounded ownership/control support. It does not claim complete economic custody or every vesting contract.

## Root causes corrected

1. Material PumpSwap reserve allocations were retained as generic unknown program accounts despite the existing owner-account batch already containing the mint-bound pool state. The classifier now verifies the pool PDA, decoded token mint and exact sampled token-account vault reference. It retains LP/withdrawal controls as separate unresolved evidence. TOMO's 48.5936% retained allocation is a verified PumpSwap reserve-account role, not an independently sellable ordinary-holder allocation.
2. A derived Pump.fun curve address was treated as verified infrastructure even when its actual account state had not been obtained. Verified infrastructure status now additionally requires the observed Pump.fun owner program, nonexecutable account and BondingCurve discriminator. A derivation-only candidate remains visible and uncertain.
3. A program-owned multisig could only be described as unknown. Exact standard SPL multisig state now exposes the supported signing threshold and signer addresses without guessing beneficial identity, vesting, lock or escrow terms.
4. The standard RPC largest-account method returns at most twenty token accounts. Excluding pools and combining common owner accounts therefore often produces17–19 eligible wallets. An optional Stage2 `token-concentration?mint=...&extend=1` path uses one existing Helius getTokenAccounts discovery page, up to60 distinct candidates, followed by authoritative same-slot mint/account re-reads and separate owner-state revalidation. Index amounts and labels never enter scoring directly. Up to20 observed eligible owner groups are selected; the result still explicitly declares rankingComplete=false and inventoryComplete=false.
5. Aggregate allocation percentages were summed as rounded floating-point percentages. Material unclassified and restricted aggregate shares now derive once from exact raw integer totals and the mint supply.

## Supported controls and limits

| Allocation type | Supported evidence | Limit |
|---|---|---|
| Ordinary wallet account | Parsed token owner, initialized/frozen state, observed system-account ownership or missing zero-lamport authority account, on-curve key, delegate/close authority | Does not establish one beneficial owner, exchange custody, team identity or wallet independence |
| Creator wallet | Same direct account evidence plus an explicitly provided separately verified creator address | No creator inferred from concentration, metadata or pool creation |
| PumpSwap reserve vault | Existing owner batch; pinned pool discriminator/layout, canonical pool PDA, exact mint and vault binding | No LP locking, LP holder identity, upgrade or global admin certification |
| Standard Raydium CLMM reserve vault | Pinned1544-byte standard PoolInfoLayout, PoolState discriminator, canonical pool and mint-specific vault PDA, exact mint/vault binding | CustomizableV2 variants remain unsupported in this narrow verifier; no position/NFT withdrawal ownership inference |
| Orca Whirlpool reserve vault |653-byte Whirlpool layout/discriminator, mint/config/tick-spacing pool PDA, exact mint/vault binding | No position withdrawal controls, upgrade controls or executable depth inferred |
| Raydium CPMM signing authority | Canonical global `vault_and_lp_mint_auth_seed` PDA from pinned SDK | Without linked pool state, the allocation remains visible and is NOT excluded as verified infrastructure |
| SPL multisig | Exact355-byte initialized layout, valid M/N threshold and unique configured signers | Does not establish beneficial ownership, timelock or release schedule |
| Frozen token account | Parsed frozen state, amount, token owner and authority program | Freeze reversal authority and future state require mint/control evidence |
| Magna-controlled allocation | Observed owner program matches published Magna deployment; Solscan independently identifies TRUMP's account as Team Allocation | No audited allocation IDL/schedule recovered; unlocks, withdrawals, beneficial ownership and admin overrides remain unresolved; never excluded |
| Other program/PDA allocation | Observed account/program role and raw amount retained | No harmless-infrastructure or permanently locked claim |

## Acceptance fixtures

- ANSEM: retained same-slot account sample shows49.2307% controlled by system wallet7oU9nR9VEvFPwvp2PpXo2LQc6A92QRhcUTwhLWT7MsDM. Initialized account control is observed; beneficial custody classification is not proven. Critical exposure must retain that scope.
- TOMO: retained48.5936% account is tied to actual PumpSwap pool4ifMsRTMGWZPWmGfqeQQsNQBhzrev5zZRbZEGRTCdVw9 and its sampled base vault. Pure verifier agrees with independently loaded pinned PumpSwap SDK fields and poolPda.
- FLOAT: largest retained6.2301% allocation uses the canonical Raydium CPMM global signing authority; no linked mint-bound pool proof is silently invented. The6.011% self-authority token account is program-controlled and is not the separately designated creator2rQ13KrAdDsAtd1LuKV1kGj6nFB4V4GsD9GAYKXi353T.
- TRUMP:70.6132% retained allocation authority2RH6rUTPBJ9rUDPpuV9b8z1YL56k1tYU6Uk5ZoaEFFSK has6593-byte account state owned by magnaSHyv8zzKJJmr8NSz5JXmtdGDTTFPEADmvNAwbj. Published program identity and explorer team label are corroboration; they do not establish schedule or current withdrawability.

## Validation

-15 focused WP03 regression tests pass, including retained live TOMO, ANSEM, FLOAT and TRUMP snapshots; borrowed/wrong mint/vault spoofing; malformed index responses; exact multisig threshold; standard CLMM binding; and SDK agreement.
- Existing19 intelligence-closure regressions also passed before subsequent integration edits.
- Default Stage1 concentration keeps its original four logical reads. Optional Stage2 expansion adds at most one discovery request; account/owner re-reads replace the original sample reads. Existing12-RPC route quota, admitted provider guard and9-second handler deadline are unchanged. No schema or provider is added.
- Stage2 index transport and fresh post-deployment samples require live qualification; no credential or authentication bypass was used here.

## Primary/reference sources

- Pinned @pump-fun/pump-swap-sdk2.1.0 `src/sdk/pda.ts` and pool IDL via installed package; no new dependency.
- Pinned @raydium-io/raydium-sdk-v2 0.2.87-alpha `src/raydium/clmm/layout.ts`, `libraries/pda.ts`, `src/raydium/cpmm/pda.ts`; no generic decoder assumption.
- Existing repo `currentPoolIdentity.mjs` references the official Orca Whirlpool state layout.
- https://www.helius.dev/blog/how-to-get-token-holders-on-solana documents the mint-bound getTokenAccounts page contract. Only one bounded page is used, not its example unbounded pagination loop.
- https://docs.magna.so/admins/privacy-and-security/magna-contract-deployments search retrieval lists the exact program. Direct full-page retrieval returned403, so no schedule or ABI claim is derived from it.
- https://solscan.io/account/2RH6rUTPBJ9rUDPpuV9b8z1YL56k1tYU6Uk5ZoaEFFSK was read and reports Team Allocation, owner Magna Core, off-curve authority and6593-byte state. Explorer labels are corroboration, not controlling proof.

## Remaining limits

No supported verified exchange beneficial-owner registry is present. General treasury, vesting/escrow schedule, Magna withdrawal/override rules, unlinked CPMM/AMMv4 pool control and customized CLMM variants remain explicit unsupported evidence. Twenty retrieved eligible owners do not imply a global Top20 ranking. This supported-scope implementation must not be presented as100% economic-control verification.
