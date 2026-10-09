# Wallet Signal v1.0 — beta release gate

## Automated checks
- RPC unit tests, Next.js production build, invalid-address handling, Mainnet API smoke tests, and empty-history wallet checks are configured in `.github/workflows/wallet-signal-v1-0.yml`.
- Verify the **latest** workflow run after every new commit. Earlier green checks do not validate subsequent changes.
- The optional `WALLET_SIGNAL_ACTIVE_TEST_ADDRESS` must be set to a known public active address to include an active wallet in the diversity suite. It is currently optional, so a green workflow alone does **not** prove active-wallet coverage.
- High-volume wallet testing and partial RPC failure simulation remain outstanding.

## Manual acceptance review
- Mobile: wallet input and Analyze button visible without scrolling at the agreed target viewport; scanning message remains visible.
- Desktop: hero, mascot, wallet input, and analysis controls align without overlap.
- Mascot blends into background without a visible image rectangle or ring.
- Scanning state never claims the signal is ready; successful evidence-qualified scans display the green mascot glow.
- Failed or partial scans, empty wallets, and insufficient coverage do not show a green signal.
- Changing the address during an in-flight scan must not show results from the previous address.
- Confirm data labels explain that activity observations are not fraud detection, investment recommendations, or wallet-safety guarantees.

## Release decision
No production merge, Vercel deployment, or domain switch is authorized. Require latest CI pass, active/high-volume test evidence, mobile/desktop screenshots, and explicit founder approval before beta release.
