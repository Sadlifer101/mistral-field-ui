# Integration checklist

A setup and end-to-end verification pass for connecting this UI to a working Mistral Convex backend. Tick items
only on observed evidence — the last section lists what may not be claimed even after a green run.

Contract details are in [`CONVEX_CONTRACT_MAP.md`](./CONVEX_CONTRACT_MAP.md); strategy descriptions are in
[`INTEGRATION_README.md`](./INTEGRATION_README.md) §5.

---

## A. Before you start

- [ ] You have the backend repository that owns `convex/` (`schema.ts`, `triageLogbook.ts`, `auth.ts`).
- [ ] You have an **isolated development deployment** — not production — and can point the app at it.
- [ ] You have an **authorized Google test account**. Do not test with a real clinician's account.
- [ ] Node 22+ and npm 10+ are installed (`node -v`, `npm -v`).
- [ ] You have read the six backend concerns in `INTEGRATION_README.md` §10 and know they are out of scope here.

## B. Setup

### Option A — separate Vite app

- [ ] `gh repo clone Sadlifer101/mistral-field-ui && cd mistral-field-ui/mistral-ui-package/mistral-ui`
- [ ] `npm ci` completes without error.
- [ ] `.env.local` contains `VITE_CONVEX_URL=` pointing at the development deployment.
- [ ] `npx convex dev` (or `npx convex codegen`) has been run **in the backend repo**, and `convex/_generated`
      in the UI repo is the regenerated one (or confirmed identical to the backend's).
- [ ] The alias resolves: `tsconfig.json` `"@convex/*": ["../../convex/_generated/*"]` and the `@convex` entry
      in `vite.config.ts` point at an existing folder.
- [ ] The origin you serve from is listed in `allowedRedirectOrigins` in `convex/auth.ts` (ask the backend
      owner; this is a backend change).
- [ ] `npm run dev` starts on the expected port; if it collides with your Next app, one of them moved **and**
      the moved origin was added to `allowedRedirectOrigins`.

### Option B — mounted in the existing Next app

- [ ] Source copied in: `src/components/*`, `src/nurse/*`, `src/utils/*`, `src/lib/clinical.ts`,
      `src/theme/glass.ts`, `src/index.css`, `src/components/specialist.css`, `src/assets/images/*`,
      `public/media/*`.
- [ ] `src/main.tsx`, the three HTML entries and `src/preview/*` were **not** copied.
- [ ] The app still uses its existing `src/components/ConvexClientProvider.tsx` — no second client, no second
      provider.
- [ ] `tsconfig.json` has `"@convex/*": ["./convex/_generated/*"]`, or the 13 imports were rewritten to
      `../../convex/_generated/...`; the choice was verified by a type check **and** a build.
- [ ] `motion`, `lucide-react`, `@radix-ui/react-select` added to dependencies — and nothing else.
- [ ] `src/index.css` imported once in the root layout; `nurse.css` and `specialist.css` imported by their
      entry components.
- [ ] The three font tokens (`--font-serif`, `--font-sans`, `--font-mono`) are defined, or the fallback
      typography was accepted deliberately.
- [ ] `/nurse` route added and gated by the existing session; specialist console mounted at its route without
      deleting the existing page content.

## C. Smoke checks

- [ ] `/` renders the specialist sign-in (or console) with **no console errors**.
- [ ] `/nurse` renders the nurse sign-in or field-unit home with **no console errors**.
- [ ] Browser network tab shows one Convex WebSocket connection, not two.
- [ ] At 390 px width there is no horizontal scrolling on `/nurse`; the two home cards fit, labels are not
      clipped.
- [ ] The nurse background renders as the still poster; the looped clip appears only when `prefers-reduced-
      motion` is off and the connection is not 2G/slow-2G.

## D. Authentication and identity

- [ ] "Continue with Google" completes and returns to the app on the same origin.
- [ ] A `users` row exists for the test account (same one your current app creates).
- [ ] A `staffProfiles` row with `role: "nurse"` exists for the nurse surface; a `city_specialist` row for the
      console. Record the values — the UI auto-creates the nurse row with `helena` / `Rural PHC Field Unit` /
      `Satara` if missing.
- [ ] Signing out returns to the sign-in screen on both surfaces.
- [ ] Theme switching on the specialist console persists across reload (localStorage `mistral_theme`).

## E. Nurse workflow (synthetic patient only)

- [ ] Home shows exactly two primary cards (New Entry, Patients & Reviews).
- [ ] New entry: name, age, sex, village accepted; Continue stays disabled until the required fields are valid.
- [ ] Vitals and symptom chips/notes are accepted and survive navigating back to Home and into the entry again.
- [ ] Cough capture starts on click, shows live bars, auto-stops at 5 seconds, and Play replays the recording.
- [ ] Phonation capture behaves the same, in its own pane.
- [ ] Submitting produces, in the dev database: a `patients` row, two storage objects, and one `screenings` row
      with `status: "uploaded"`, `reviewStatus: "pending_review"`, non-null `coughAudioId`/`speechAudioId`, and
      a `frequencyChartData` object.
- [ ] The report screen shows the differential, level-1 status and the "awaiting city doctor approval" state;
      it does not claim the screening was reviewed.
- [ ] Attaching an image or PDF after submission writes a `patientDocuments` row and a success notice.
- [ ] Patients & Reviews lists the new patient with an "Awaiting review" badge.

## F. Specialist workflow

- [ ] The queue shows the new screening under pending.
- [ ] Opening it loads the patient workspace: FFT chart renders from `frequencyChartData.fftBins`, waveform
      player plays the stored cough and voice audio.
- [ ] Logbook shows the screening history; attached document is listed and downloadable.
- [ ] Review with `physicalReferralFlag: false` and a remark: row moves from pending to previous,
      `reviewStatus` becomes `"reviewed"`, `reviewedBySpecialistId`/`reviewedByName` are set.
- [ ] Review a second screening with `physicalReferralFlag: true`: `reviewStatus` becomes `"physical_referral"`,
      the row appears under referrals, and the referral instructions are stored.

## G. Feedback loop back to the nurse

- [ ] Reopening Patients & Reviews, the reviewed patient now shows "Reviewed" (and "Referral" for the second).
- [ ] Opening the patient's feedback panel shows the specialist remark, approved medication (if any), referral
      instructions (if any) and the reviewing specialist's name.
- [ ] A patient with **no** screening shows "No screening yet" rather than a blank badge.

## H. Regression checks on the existing application

- [ ] Existing routes still build and render (landing, sign-in, dashboard) — nothing deleted or replaced
      without approval.
- [ ] Existing Convex functions are unchanged: `git diff --stat -- convex/` shows no modifications.
- [ ] `convex/schema.ts`, `convex/auth.ts` and `convex/auth.config.ts` are byte-identical to the last commit
      (unless the developer approved an origin addition, which would be the only allowed change).
- [ ] No new tables, indexes or status fields were introduced.
- [ ] `npm run build` succeeds.

## I. What a green run does **not** prove

- Not that the system is production-secure. Reads are authenticated-only, the specialist queue is global and
  capped at 100 rows, staff roles can be self-assigned, legacy screenings lack `reviewStatus`, and the
  reviewer identity is partly client-supplied. All are backend work.
- Not that clinical output is valid. The local acoustic differential is a frontend heuristic; the backend
  pipeline is authoritative.
- Not that offline, low-bandwidth, iOS Safari, landscape or physical-device capture behave correctly — those
  paths were never exercised during development.
- Not that other deployments behave the same. Verify against the deployment you will actually run.

## J. Sign-off

| Field | Value |
| --- | --- |
| Integration shape | A / B |
| Deployment used | |
| Test Google account | |
| Commit / branch | |
| Date | |
| Build + type check | pass / fail |
| Sections C–G | pass / fail (note failures) |
| Backend files modified | none expected — list any approved exception |
| Remaining blockers | |
