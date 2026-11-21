# Mistral Field UI

Frontend for **Mistral / SpiroVoice** — a respiratory triage system for rural PHC field units, built around
cough and voice acoustics. This repository contains the redesigned **React UI only**: a mobile nurse field
unit and a specialist clinical console, wired to the Mistral Convex backend contract.

**It is not a backend.** Schema, Google OAuth, clinical processing and deployments stay with the backend
owner. Nothing here writes to or replaces them.

| Surface | Route | What it does |
| --- | --- | --- |
| Nurse field unit | `/nurse` | Register a patient, vitals and symptoms, record 5-second cough and phonation samples, see the local acoustic differential, submit the screening, attach documents, track doctor feedback |
| Specialist console | `/` | Sign in, work the triage queue (pending / previous / referrals), open a patient workspace with FFT and waveform playback, review, approve medication or refer physically |

## Look at it without a backend

```bash
gh repo clone Sadlifer101/mistral-field-ui && cd mistral-field-ui/mistral-ui-package/mistral-ui
npm ci
npm run dev:preview      # http://localhost:3010/nurse.html  and  /preview.html
```

The preview harness swaps the Convex layer for fixtures and a fake microphone. It never talks to a deployment
and writes nothing. Use it to review the UI; use a real backend to test the workflows.

## Connect it to a backend

```bash
cd mistral-ui-package/mistral-ui
echo 'VITE_CONVEX_URL=https://<your-deployment>.convex.cloud' > .env.local
npm run dev              # http://localhost:3000/ and http://localhost:3000/nurse
```

Then make sure Google sign-in can return to your origin (`allowedRedirectOrigins` in your `convex/auth.ts`).
Full setup, both integration strategies and the Convex contract are in
[`INTEGRATION_README.md`](./INTEGRATION_README.md).

## Repository map

```
mistral-ui-package/mistral-ui/   React 19 + TypeScript 7 + Vite 8 + Tailwind v4 app
  src/components/                specialist console, auth UI, shared shell, charts, audio player
  src/nurse/                     nurse field unit + its own design system (nurse.css)
  src/utils/                     MediaRecorder capture, acoustic engine, facility locator
  public/media/                  nurse meadow background video + poster
convex/_generated/               generated Convex client references (regenerate from your backend)
```

## Documentation

| Document | Contents |
| --- | --- |
| [`INTEGRATION_README.md`](./INTEGRATION_README.md) | Setup, Option A / Option B integration strategies, auth, aliases, backend concerns |
| [`CONVEX_CONTRACT_MAP.md`](./CONVEX_CONTRACT_MAP.md) | Every function called, with validators, return fields, call sites and both state machines |
| [`INTEGRATION_CHECKLIST.md`](./INTEGRATION_CHECKLIST.md) | Step-by-step setup and end-to-end verification |
| [`CURSOR_INTEGRATION_PROMPT.md`](./CURSOR_INTEGRATION_PROMPT.md) | Paste-ready prompt that lets Cursor do the integration |
| [`FUNCTIONALITY_CHECKLIST.md`](./FUNCTIONALITY_CHECKLIST.md) | Status per feature: verified, implemented, unverified, blocked, not implemented |
| [`PACKAGE_MANIFEST.md`](./PACKAGE_MANIFEST.md) / [`SHA256SUMS.txt`](./SHA256SUMS.txt) | Inventory, packaging record, per-file checksums |

## Status, stated plainly

- **Not tested end to end against a live deployment.** The authoring environment's deployment had placeholder
  Google credentials, so sign-in stopped at Google with `invalid_client`. Everything is wired and type-checked;
  your integration test is the first real one.
- **Not production-secure.** Reads are authenticated-only, the specialist queue is global and capped at 100
  rows, staff roles can be self-assigned through `upsertStaffProfile`, and legacy screenings have no
  `reviewStatus`. These are backend concerns, listed in `INTEGRATION_README.md` §10.
- **No offline mode.** Patient data is never stored in the browser; there are no drafts and no retry queue.

## Provenance and licensing

- The UI was designed and implemented for this project. Two interaction patterns are adapted from the
  author's own private UI Forge prototypes (`atelier-vale/cinematic-hero` for the poster-first media
  behaviour, `editorial-stagger` for list stagger); no third-party library source and **no UI Forge media
  assets** are included. Attribution details are in `PACKAGE_MANIFEST.md`.
- Background imagery and the meadow clip were produced for this project; no stock or clinical imagery of real
  people is included. Preview/demo data is synthetic.
- Typefaces are loaded from Google Fonts at runtime (Cormorant Garamond, Plus Jakarta Sans, IBM Plex Mono);
  no font binaries are redistributed here.
