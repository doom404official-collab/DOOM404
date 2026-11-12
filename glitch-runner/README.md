# DOOM404 GLITCH RUNNER V4

Isolated game workspace for the existing DOOM404 GLITCH RUNNER V4.

## Static game files

Place these files together in this directory:
- `index.html` (latest responsive-refined build)
- `doom404-mascot-optimized.glb` (optimized, animated DOOM404 mascot)

The HTML currently loads the GLB by relative path, so both files must be in the same directory.

## Vercel

Connect the **existing** Vercel project `doom404-runner-v4-fresh-download-20261112` to GitHub repository `doom404official-collab/DOOM404` and set its Root Directory to `glitch-runner`. Use branch `feature/glitch-runner-v4` for Preview deployments. Do not alter the existing production branch or deploy this branch to production until tested.

## Acceptance checks

Verify 3D mascot visibility and rightward orientation, running animation speed, jump/double-jump, landing, game-over lessons, and desktop/Android responsiveness.
