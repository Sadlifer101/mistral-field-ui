# Integration guide

How to run this frontend and connect it to a **working** Mistral Convex backend. Written for a developer who
already has the backend running; nothing here asks you to change schema, functions, auth or deployments.

> The function-by-function dependency map lives in [`CONVEX_CONTRACT_MAP.md`](./CONVEX_CONTRACT_MAP.md).
> Per-feature status (verified vs unverified) lives in [`FUNCTIONALITY_CHECKLIST.md`](./FUNCTIONALITY_CHECKLIST.md).
> The agent-ready version of these instructions is [`CURSOR_INTEGRATION_PROMPT.md`](./CURSOR_INTEGRATION_PROMPT.md).

---

## 1. What this repository contains

Two surfaces built on one Convex contract:

- **Nurse field unit** (`/nurse`) — patient registration, vitals and symptoms, 5-second cough and phonation
  capture, local acoustic differential, screening submission, document attach, patient list with doctor
  feedback.
- **Specialist console** (`/`) — sign-in/onboarding, triage queue partitioned into pending / previous /
  referrals, patient workspace with FFT and waveform playback, longitudinal logbook, review with medication
  approval or physical referral.

Both talk to your backend through the same thirteen references listed in the contract map.

## 2. Stack

React 19 · TypeScript 7 · Vite 8 · Tailwind CSS v4 · `motion` · `lucide-react` · `@radix-ui/react-select` ·
`convex` 1.50 · `@convex-dev/auth` 2.0 (+ `@auth/core` 0.41).

## 3. Layout

```
mistral-ui-package/mistral-ui/     the app (npm project; all commands below run here)
  index.html                       production entry: specialist at /, nurse at /nurse
  nurse.html preview.html motion.html   dev-only fixture harnesses (never built)
  public/media/                    nurse meadow video + poster
  src/components/                  specialist console, auth UI, shared shell
  src/nurse/                       nurse field unit + its own design system (nurse.css)
  src/utils/                       audio recorder, acoustic engine, facility locator
convex/_generated/                 generated client references (see §6)
```

## 4. Quick start (Option A — separate Vite app)

Verified against this repository; each command matches `package.json`.

```bash
# 1. clone the UI
gh repo clone Sadlifer101/mistral-field-ui
cd mistral-field-ui

# 2. the frontend source directory
cd mistral-ui-package/mistral-ui

# 3. install with the committed lockfile
npm ci

# 4. point it at your deployment
echo 'VITE_CONVEX_URL=https://<your-deployment>.convex.cloud' > .env.local

# 5. regenerate the client references from YOUR backend, in the repo that owns convex/
#    (skip only if your convex/ is identical to the tree this UI was built against — see §6)
npx convex dev        # or: npx convex codegen

# 6. Google OAuth: keep your existing client id/secret on the deployment and make sure
#    the origin you serve the UI from is in allowedRedirectOrigins (convex/auth.ts)

# 7. run
npm run dev           # http://localhost:3000/  and  http://localhost:3000/nurse

# 8. verify the workflows with the checklist
open INTEGRATION_CHECKLIST.md
```

`npm run dev` binds port **3000**. If your Next app also defaults to 3000, one of the two must move — and the
moved origin must be added to `allowedRedirectOrigins`, or Google sign-in fails at the redirect step.

## 5. Two integration strategies

### Option A — separate Vite app against the existing deployment (recommended)

Keep this repository as its own app and point it at your deployment. Lowest risk: your backend, auth and
deployment are untouched.

**What you need**

| Requirement | Why |
| --- | --- |
| `VITE_CONVEX_URL` in `.env.local` | The only environment variable the app reads (`src/main.tsx:8`). |
| Your origin in `allowedRedirectOrigins` | Google sign-in redirects back to the app. Adding an origin is a one-line change in **your** `convex/auth.ts`, with your approval. |
| `convex/_generated` matching your backend | Runtime references + types (§6). |
| A host that rewrites `/nurse` to `index.html` | The build emits a single `index.html`; both surfaces are path-driven. Vite dev does this automatically. |

**Trade-offs**: two dev servers, two deploys, a second origin to configure, and users crossing between
surfaces via link. In exchange, nothing in your existing app can regress.

Deployment note: build with `npm run build` (outputs `dist/`), serve it behind any static host with an SPA
fallback, and add that production origin to `allowedRedirectOrigins` too.

### Option B — mount the redesigned React UI inside your existing Next app

Compatible with a Next 16 + React 19 shell that already has Convex and Convex Auth wired up (the reference
backend app is exactly that: `src/app/{layout,page,dashboard,signin}`, `src/components/ConvexClientProvider.tsx`,
Tailwind 4 via `@tailwindcss/turbopack`).

**Do not mount this app's `src/main.tsx`** — it creates a second `ConvexReactClient` and a second
`ConvexAuthProvider`. Your existing provider already supplies both, with the same `api.auth.*` mapping.

Steps, with the considerations that actually bite:

1. **Copy the source, not the shell.** Bring in `src/components/*`, `src/nurse/*`, `src/utils/*`,
   `src/lib/clinical.ts`, `src/theme/glass.ts`, `src/index.css`, `src/nurse/nurse.css`,
   `src/components/specialist.css`, plus `src/assets/images/*` and `public/media/*`. Skip `src/main.tsx`,
   the three HTML entries and `src/preview/*` (fixtures).
2. **Alias.** Add `"@convex/*": ["./convex/_generated/*"]` to your `tsconfig.json` `paths`. If the bundler
   does not resolve it, the verified fallback is the style your own provider already uses:
   `import { api } from "../../convex/_generated/api"` (mechanical rewrite across 13 files). Confirm with a
   type check and a build; do not ship whichever path is unresolved.
3. **Routing.** Add a `/nurse` route (`src/app/nurse/page.tsx`, a client component) that renders
   `<MobileNurseApp nurse={profile} onSignOut={signOut} />`, and mount the specialist surfaces at your
   dashboard route. The Vite shell's `App.tsx` (path-watching + gates) can be replaced by your router — it is
   not required by the screens.
4. **Auth gates stay yours.** `App.tsx` demonstrates the order (session → staff profile → onboarding), but in
   Next the gate belongs in your layout/middleware. `MobileNurseApp` still queries
   `getMyStaffProfile({ role: "nurse" })` itself and requires a `nurse` staff profile.
5. **Styling.** Your app already runs Tailwind v4 through `@tailwindcss/turbopack`; the UI's
   `src/index.css` uses `@import "tailwindcss"` + `@theme` tokens, so import it once in your root layout.
   `specialist.css` and `nurse.css` are plain scoped CSS and coexist with it (nurse classes are all `.nv-*`).
6. **Fonts.** The UI's tokens reference `--font-serif` (Cormorant Garamond), `--font-sans` (Plus Jakarta Sans)
   and `--font-mono` (IBM Plex Mono). Your layout currently defines Geist variables. Either load the three
   families via `next/font/google` and map the three custom properties, or accept the CSS fallbacks
   (Georgia / system sans / monospace) — the layout works either way, the typography does not.
7. **Dependencies to add** (not in a Convex-only Next app): `motion`, `lucide-react`,
   `@radix-ui/react-select`. React 19.3 and Tailwind 4 are already present; `@radix-ui/react-dropdown-menu`
   is declared by the Vite project but **not imported** by any component.
8. **Assets.** Copy `public/media/*` to your `public/media/`; keep `src/assets/images/*` next to the
   components (both bundlers handle static image imports).
9. **No environment variable needed.** The shipped app reads `import.meta.env.VITE_CONVEX_URL` only inside
   `main.tsx`; your provider already reads `NEXT_PUBLIC_CONVEX_URL`. Do not add a second client.

**Trade-offs**: you inherit the UI's CSS and fonts into your shell, and the integration touches your app.

Either strategy keeps your backend authoritative. Do not migrate the backend to another runtime, and do not
re-implement these functions.

## 6. Environment variables

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `VITE_CONVEX_URL` | frontend (Option A) | yes | Passed to `new ConvexReactClient(...)`. |
| `NEXT_PUBLIC_CONVEX_URL` | frontend (Option B) | already set | Use your existing provider. |
| `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET` | deployment | already set | Google OAuth; never in this repository. |
| `CONVEX_SITE_URL` | deployment | provided by Convex | Used by `allowedRedirectOrigins` and `http.ts`. |
| `GEMINI_API_KEY` | backend pipeline | optional | Not read by this frontend. |

`.env.example` lists the names only. No credentials are shipped.

## 7. Generated references and the `@convex/api` alias

`api.js` is a reference factory (`anyApi`), not backend code; `api.d.ts` / `dataModel.d.ts` are type-only and
`import type` your `convex/` modules.

| Situation | Action |
| --- | --- |
| Your `convex/` matches the tree this UI was built against | The bundled `convex/_generated` is usable as-is. |
| Anything differs (renamed function, changed argument key, new module) | Run `npx convex dev` in the repo that owns `convex/`, then point the alias at the regenerated folder. |
| Any case | Never hand-edit `_generated`. |

The alias path arithmetic is `../../convex/_generated` from `mistral-ui-package/mistral-ui`, which is why this
repository ships `convex/_generated` at its root. Re-locating the app changes **both** the Vite alias and the
tsconfig `paths` entry. Full matrix in [`CONVEX_CONTRACT_MAP.md`](./CONVEX_CONTRACT_MAP.md) §1.

## 8. Preserving Google OAuth

- The UI calls `useSignInWithGoogle(api.auth)` and relies on the provider's `api.auth.*` mapping — the same
  three exports (`refreshSession`, `signOut`, `isAuthenticated`) your app already passes.
- Keep your OAuth client, redirect URIs and existing user identities. Signing in must produce the **same**
  `users` row as your current app, or staff profiles will not line up.
- `allowedRedirectOrigins` gates the redirect. The current hard-coded value only allows
  `http://localhost:3000`; add any other origin you serve from, deliberately.
- Do not add a password/developer bypass to "test faster". Use a Google test account.

## 9. Entry points and routing

| URL | Entry | Surface |
| --- | --- | --- |
| `/` | `index.html` | Specialist console, or sign-in/onboarding |
| `/nurse`, `/nurse/` | `index.html` (path check in `src/App.tsx`) | Nurse field unit, or compact nurse sign-in |

Dev server note: `nurse.html` exists at the app root for the fixture harness, and Vite would otherwise resolve
`/nurse` to it. `vite.config.ts` contains a dev-only middleware (`nurse-route-entry`) that rewrites `/nurse` to
`index.html`. Keep it unless you remove `nurse.html`.

Production note: emit `dist/` and serve `index.html` for `/nurse` (SPA fallback).

## 10. Backend concerns this frontend does **not** fix

Documented for the backend owner; the UI does not paper over any of them.

1. **Specialist-role self-assignment** — `upsertStaffProfile` accepts `role` from the client, so any
   authenticated user can grant themselves `city_specialist`.
2. **Staff-role validation fallback** — `requireStaffProfile(ctx, role)` falls back to *any* staff row when the
   requested role is missing, so a missing profile degrades into a different role instead of failing closed.
3. **Global specialist queue** — `getSpecialistTriageQueue` is not scoped by facility, district or assigned
   specialist; every specialist can read every patient's queue row.
4. **100-screening query limit** — the queue takes at most 100 rows, the roster 30, logbook screenings 100 /
   documents 50, with no pagination; older work silently falls out of view.
5. **Legacy screenings without `reviewStatus`** — rows written before the field existed have `undefined`
   `reviewStatus`; the UI treats that as "Awaiting review", but the queue partition cannot distinguish them.
6. **Duplicate Convex source trees** — `convex/` exists in more than one checkout with identical contents
   today. Keep one authoritative copy (the deployed backend) and regenerate `_generated` from it, or the UI
   and the deployment will drift.

Also worth knowing before a demo: reads are authenticated-only (no per-role read gate), the reviewer identity
on a review is partly client-supplied, and `createLogbookPatient` mints `SV-` + four random digits with no
uniqueness check.

**Integration working does not make this production-secure.** Treat authorization, audit and pagination as
open backend work.

## 11. Frontend limitations (unchanged, intentional)

- No drafts, no offline queue, no local persistence of patient data; closing the tab loses an in-progress entry.
- 5-second capture per channel; the protocol is not configurable from the UI.
- No patient-ID field (the backend mints `patientCode`); phone is optional.
- Status vocabulary is exactly the two state machines in the contract map.
- The nurse "Doctor Reviews" tab reads the specialist queue, which is global and capped (see §10.3–4).
- Landscape layout, real microphone permission prompts, iOS Safari, genuine 2G/3G and physical-device capture
  were never exercised.
- `nurse.html`, `preview.html`, `motion.html`, `src/preview/*`, `src/data/mockTriageData.ts` and
  `src/utils/audioSynthesizer.ts` are development helpers with synthetic data. Never wire them to a real
  deployment.

## 12. What has actually been verified

Run in the authoring environment against this repository's contents:

- `npx vite build` — success, 2259 modules, single `index.html` entry, assets emitted.
- `npx tsc --noEmit` — success, with the backend `convex/` tree present for `api.d.ts` module resolution.
- Browser QA at 320/360/375/390/414/430/768 px — no horizontal overflow, no console errors (nurse surfaces).
- Capture, local acoustic report, patients/reviews rendering and feedback panel — exercised with a fake
  microphone and fixture data.

**Not verified**: an authenticated end-to-end run against a live deployment. The authoring environment's
deployment had placeholder Google credentials, so sign-in stopped at Google with `invalid_client`. Every
authenticated read and write is wired and type-checked, not proven live. Your integration test is the first
real one — use [`INTEGRATION_CHECKLIST.md`](./INTEGRATION_CHECKLIST.md).

## 13. Read next

| Document | Use it for |
| --- | --- |
| [`CONVEX_CONTRACT_MAP.md`](./CONVEX_CONTRACT_MAP.md) | Exact functions, arguments, return fields, state machines |
| [`INTEGRATION_CHECKLIST.md`](./INTEGRATION_CHECKLIST.md) | Step-by-step setup and end-to-end verification |
| [`CURSOR_INTEGRATION_PROMPT.md`](./CURSOR_INTEGRATION_PROMPT.md) | Hand the whole job to Cursor |
| [`FUNCTIONALITY_CHECKLIST.md`](./FUNCTIONALITY_CHECKLIST.md) | Feature status and evidence |
| [`PACKAGE_MANIFEST.md`](./PACKAGE_MANIFEST.md) | Inventory, checksums, packaging record |
