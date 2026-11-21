# Mistral Field UI — frontend handoff

The complete redesigned Mistral frontend: nurse field unit + specialist console. This repository contains
**frontend code only** — it is meant to be integrated against the existing Convex backend, not to replace it.

Published from `mistral-full/mistral-ui-package/mistral-ui` @ `fddecb5`.

## What is inside

| Path | What it is |
| --- | --- |
| `mistral-ui-package/mistral-ui/` | The application (React 19 + TypeScript 7 + Vite 8 + Tailwind v4) |
| `mistral-ui-package/mistral-ui/src/nurse/` | Nurse field unit: home, new entry, audio capture, screening report, patients & reviews, doctor feedback |
| `mistral-ui-package/mistral-ui/src/components/` | Specialist console: dashboard, queue, patient workspace, sign-off, logbook, waveform player, FFT chart, fluid backdrop |
| `mistral-ui-package/mistral-ui/public/media/` | Nurse meadow background video + poster |
| `convex/_generated/` | Generated Convex **client** references the UI compiles against (regenerate from your deployment) |
| `INTEGRATION_README.md` | Stack, structure, env vars, auth, Convex contract map, audio/review flows, integration steps, limitations |
| `FUNCTIONALITY_CHECKLIST.md` | Feature-by-feature status: verified / implemented / unverified / blocked / not implemented |
| `PACKAGE_MANIFEST.md` | Inventory, exclusions, verification record, packaging notes |
| `SHA256SUMS.txt` | Per-file SHA-256 of every shipped file (`sha256sum -c SHA256SUMS.txt`) |

## Quick start

```bash
cd mistral-ui-package/mistral-ui
npm ci
echo 'VITE_CONVEX_URL=https://<your-deployment>.convex.cloud' > .env.local
npm run dev        # http://localhost:3000/       specialist console
                   # http://localhost:3000/nurse   nurse field unit
```

Then, in the repository that holds your `convex/` directory, run `npx convex dev` to regenerate
`convex/_generated/*`, and keep the `@convex → ../../convex/_generated` alias (or adjust it together with
`tsconfig.json` — see `INTEGRATION_README.md` §8).

## Read next

1. `INTEGRATION_README.md` — §4 environment variables, §5 auth wiring, §8 aliases and codegen, §11 the 13
   Convex functions actually called (with argument validators and call sites), §12–13 the audio/submission and
   review/referral flows, §14 how to integrate without touching your backend, §15 limitations.
2. `FUNCTIONALITY_CHECKLIST.md` — what is genuinely verified versus merely implemented.

## Status, stated plainly

- No authenticated end-to-end run has been performed against a live Convex deployment (the authoring
  environment had placeholder Google credentials, so sign-in stopped at Google with `invalid_client`).
  Every write path is wired and type-checked against the documented contract, but **unverified live**.
- `convex/auth.ts` currently hard-codes `allowedRedirectOrigins` to `http://localhost:3000`; add your origin
  before expecting Google sign-in to work anywhere else.
- Authorization and pagination gaps in the backend (reads are authentication-only, queue/roster capped at
  100/30) are listed in `INTEGRATION_README.md` §15 for your review. No backend changes were made.
- Fonts are loaded from Google Fonts via `<link>` (no font binaries bundled); background imagery and the
  meadow clip were generated for this project.

## Excluded on purpose

`node_modules`, build output, `.env.local`, backend sources, deployment state, recordings, patient documents,
OAuth credentials and git history from the source monorepo.
