# Cursor integration prompt

Paste everything from **"PROMPT START"** to **"PROMPT END"** into Cursor's agent chat, with Cursor opened at the
root of the backend application that already runs Mistral's Convex backend (the repo that contains
`convex/schema.ts`, `convex/triageLogbook.ts`, `convex/auth.ts` and the working app shell).

Nothing outside those markers is part of the prompt.

---

## PROMPT START

You are integrating a redesigned React frontend into this existing Mistral application. Work in this
repository; treat its Convex backend as authoritative and untouchable.

### What Mistral does

Mistral (also named SpiroVoice) is a respiratory triage system for rural PHC field units. A nurse registers a
patient, captures a 5-second cough sample and a 5-second sustained-vowel sample, and submits a screening. The
backend stores the audio and runs the clinical pipeline. A city specialist later opens that screening from a
triage queue, sees the acoustic differential, waveform and FFT data plus the patient's history, and records a
review — approving provisional medication or flagging a mandatory physical referral. The nurse reopens the
patient list and reads that feedback. Two state fields carry the whole workflow: `screenings.status` (pipeline)
and `screenings.reviewStatus` (specialist review).

The redesigned UI lives in a public repository and consists of two surfaces:

- **Nurse field unit** (`/nurse`): home with two entry cards, patient registration (name, age, sex, village,
  optional phone), vitals (SpO₂, respiratory rate, temperature), symptoms and multilingual notes, cough +
  phonation capture with waveform, a screening report with a local acoustic differential, document attach,
  and a "Patients & Reviews" list with doctor feedback.
- **Specialist console** (`/`): sign-in and onboarding, dashboard, queue partitioned into pending / previous /
  referrals, patient workspace with FFT chart, waveform playback, logbook history and documents, and a sign-off
  panel that writes the review.

### Objective

Make those two surfaces usable in this application against its existing Convex backend, preserving every
existing clinical function, graph, recording and playback behaviour — without redesigning the UI and without
restructuring the backend.

### Hard constraints — do not violate these

1. **Do not modify** `convex/schema.ts`, `convex/auth.ts`, `convex/auth.config.ts`, any existing function in
   `convex/` (including `triageLogbook.ts`, `aiPipeline.ts`, `screeningInternal.ts`, `patients.ts`,
   `screenings.ts`, `users.ts`), the deployment configuration, or the database. If something genuinely must
   change on the backend, **stop and ask** — do not do it unilaterally.
2. **Do not change authentication.** Keep Google OAuth, the existing `ConvexAuthProvider` wiring and the
   existing user identities. No password providers, no dev bypass, no anonymous access.
3. **Do not redesign the UI.** Preserve the nurse visual system (warm off-white / sage / olive, `.nv-*`
   classes, `nurse.css`) and the specialist visual system (dark glass/plum, `specialist.css`, `FluidBackdrop`).
   Do not import the specialist glass theme into the nurse app.
4. **Do not create duplicate backend implementations**, new tables, new status fields or alternative clinical
   workflows. The two state machines below are the only ones.
5. **Do not copy the backend** from the UI repository into this repo. The UI repo ships only generated client
   references (`convex/_generated`), which you will regenerate from *this* repo (see Step 4).
6. **Do not remove** existing pages, routes or features of this app without asking. Add the new surfaces; keep
   the old ones working until the developer says otherwise.
7. Do not add production dependencies beyond the ones named in Step 3. No new state managers, no router
   replacement, no CSS framework change.

### Step 0 — Inspect before you touch anything

Read, and summarise back to me, the actual state of:

- `convex/schema.ts` — the validators and table shapes (`sexValidator`, `preferredLangValidator`,
  `staffRoleValidator`, `screeningStatusValidator`, `reviewStatusValidator`, `level1StatusValidator`,
  `patientDocTypeValidator`, `frequencyChartDataValidator`).
- `convex/triageLogbook.ts` — confirm the ten functions listed in Step 4 exist with these exact names and
  argument keys; note any difference instead of assuming.
- `convex/auth.ts` — the Google setup and `allowedRedirectOrigins`.
- `package.json` — Next/React/Tailwind versions and scripts (`dev`, `build`, `lint`).
- `tsconfig.json` — existing `paths` aliases.
- `src/components/ConvexClientProvider.tsx` — how the Convex client and `ConvexAuthProvider` are already wired.
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/signin/page.tsx`, and
  `next.config.ts` — the shell you are integrating into.
- Any existing audio components (`src/components/AudioChannelCard.tsx`) and their recording/upload code.

Report what you found, and any mismatch with Step 4, **before** editing files.

### Step 1 — Get the UI source

```bash
gh repo clone Sadlifer101/mistral-field-ui      # or: git clone https://github.com/Sadlifer101/mistral-field-ui
```

Public repository, default branch `main`. The app is at `mistral-ui-package/mistral-ui/`. Read first:

- `INTEGRATION_README.md` §5 — both integration strategies and their trade-offs.
- `CONVEX_CONTRACT_MAP.md` — the full dependency map this prompt summarises.
- `INTEGRATION_CHECKLIST.md` — the verification you will be asked to run.

Do not commit the cloned repository into this one. Copy the source files you need (Step 3) and delete the clone
when done.

### Step 2 — Choose the integration shape, and say which you chose before editing

- **Option A — run the UI as its own app against this backend.** Preferred when you do not want this repo's
  build or runtime touched at all. The UI keeps its Vite build; it only needs `VITE_CONVEX_URL`, a generated
  client that matches this backend, and your origin in `allowedRedirectOrigins`.
- **Option B — mount the redesigned screens inside this Next app.** Appropriate here if you want one
  deployment and one auth provider; this app already has Convex + Convex Auth + Tailwind v4 wired.

State your choice and a one-paragraph justification, then continue. If both are viable, default to **Option B**
for a single deployment, unless it would require modifying the backend (it should not).

### Step 3A — Option A wiring

1. In the cloned UI app: `cd mistral-ui-package/mistral-ui && npm ci`.
2. Write `.env.local` with `VITE_CONVEX_URL=<this deployment's URL>` (same URL this app uses).
3. Regenerate the client references here: `npx convex dev` (or `npx convex codegen`), then point the UI's
   alias at this repo's `convex/_generated` — `tsconfig.json` `"@convex/*": ["../../convex/_generated/*"]` and
   the `@convex` entry in `vite.config.ts`.
4. Ports: the UI's `npm run dev` binds **3000**, which this Next app also uses. Move one of them and add the
   moved origin to `allowedRedirectOrigins` in `convex/auth.ts` — **ask before editing that file**; until it is
   approved, run the UI at `http://localhost:3000` and this app on another port.
5. Never add the UI's `convex/_generated` over this repo's; regenerate instead.

### Step 3B — Option B wiring (inside this Next app)

1. Copy from the clone into this repo, keeping relative structure:
   - `src/components/*` (specialist console, auth UI, shared shell, charts, audio player) — **excluding**
     `src/main.tsx`, the three HTML entries, and `src/preview/*`.
   - `src/nurse/*` (field unit, `nurse.css`, `contract.ts`, `patientStatus.ts`) **including** `nurse.css`.
   - `src/utils/*`, `src/lib/clinical.ts`, `src/theme/glass.ts`, `src/index.css`,
     `src/components/specialist.css`, `src/assets/images/*`.
   - `public/media/*` → this repo's `public/media/`.
2. **Do not mount `src/main.tsx`.** It creates a second `ConvexReactClient` and `ConvexAuthProvider`. This repo
   already has them in `src/components/ConvexClientProvider.tsx` with the same `api.auth.*` mapping
   (`refreshSession`, `signOut`, `isAuthenticated`). Reuse it.
3. **Alias.** Add `"@convex/*": ["./convex/_generated/*"]` to the `paths` in `tsconfig.json`. If the bundler
   does not resolve it, use the style this repo already uses — `import { api } from "../../convex/_generated/api"`
   — and rewrite the 13 importing files accordingly. Verify with a type check and a build; do not leave an
   alias unresolved in either place.
4. **Routes.** Add `src/app/nurse/page.tsx` (client component) rendering
   `<MobileNurseApp nurse={profile} onSignOut={signOut} />`, gated by your existing session (a `nurse` staff
   profile must exist — the component queries `getMyStaffProfile({ role: "nurse" })` itself). Mount the
   specialist screens at `src/app/dashboard/page.tsx` (or a sibling route you prefer) instead of replacing the
   page outright: render the console inside it. The Vite shell `App.tsx` is **not** needed — its gates can be
   re-expressed in your layout/router.
5. **Styles.** Import `src/index.css` once in `src/app/layout.tsx` (it is Tailwind v4: `@import "tailwindcss"`
   + `@theme` tokens). `specialist.css` and `nurse.css` are scoped plain CSS and can be imported by their
   respective entry components. This app already compiles Tailwind via `@tailwindcss/turbopack`; keep that.
6. **Fonts.** The UI tokens expect `--font-serif` (Cormorant Garamond), `--font-sans` (Plus Jakarta Sans) and
   `--font-mono` (IBM Plex Mono). This layout defines Geist variables instead. Load the three families with
   `next/font/google` and map them to those three custom properties; otherwise the layout still works but the
   typography falls back to Georgia / system sans / monospace. Do not change the UI's font sizes to compensate.
7. **Dependencies to add**: `motion`, `lucide-react`, `@radix-ui/react-select`. That is the complete list —
   `@radix-ui/react-dropdown-menu` is declared by the UI project but not imported anywhere.
8. Do not add `VITE_CONVEX_URL`; this app reads `NEXT_PUBLIC_CONVEX_URL` already.

### Step 4 — Align with the existing Convex contract

The UI calls exactly these references. Confirm each exists in this repo with the same argument keys before
wiring; if one differs, adapt the **frontend** call site (all of them are listed) and tell me.

| Reference | Kind | Arguments |
| --- | --- | --- |
| `api.auth.refreshSession` / `api.auth.signOut` / `api.auth.isAuthenticated` | action / action / query | — (provider `api` prop) |
| `api.triageLogbook.getMyStaffProfile` | query | `{ role?: "nurse" \| "primary_doctor" \| "city_specialist" }` |
| `api.triageLogbook.upsertStaffProfile` | mutation | `{ role, fullName, facilityName, district, hprRegistrationId?, phoneNumber? }` |
| `api.triageLogbook.searchOrListPatients` | query | `{ search?: string }` |
| `api.triageLogbook.createLogbookPatient` | mutation | `{ fullName, age, sex: "M"\|"F"\|"O", village, preferredLang, smokingHistory, phone?, chronicConditions? }` |
| `api.triageLogbook.generateAudioUploadUrl` | mutation | `{}` → upload URL string |
| `api.triageLogbook.submitTriageScreening` | mutation | `{ patientId, coughAudioId, speechAudioId, rawAudioBytes?, compressedAudioBytes?, compressionRatio?, frequencyChartData?, symptomNotes?, spo2Percent?, respiratoryRate?, temperatureC?, provisionalMedication?, aiClinicalBrief?, rawTranscript?, translatedEnText?, level1Status?, predictedConditions? }` |
| `api.triageLogbook.getPatientLogbook` | query | `{ patientId }` → `{ patient, screenings[], documents[] }` |
| `api.triageLogbook.attachPatientDocument` | mutation | `{ patientId, screeningId?, fileId, fileName, docType, notes? }` |
| `api.triageLogbook.getSpecialistTriageQueue` | query | `{ statusFilter?: "pending_review"\|"reviewed"\|"physical_referral" }` |
| `api.triageLogbook.submitSpecialistReview` | mutation | `{ screeningId, specialistRemarks, physicalReferralFlag, referralInstructions?, provisionalMedication?, medicationApproved?, approvedMedication?, reviewedByName?, reviewedByPhone?, reviewedByFacility?, reviewedByDistrict? }` |

Call sites in the UI (for the Option B import rewrite): `src/main.tsx`, `src/App.tsx`,
`src/components/{MobileNurseApp,SpecialistConsole,SpecialistSignOffPanel,PatientDiagnosticWorkspace,PatientDirectoryList,WelcomeAuthPage}.tsx`,
`src/lib/clinical.ts`, `src/nurse/{contract,NewEntryScreen,PatientsReviewsScreen,PatientFeedbackPanel}.ts(x)`.

**Preserve the state machines exactly:**

- `screenings.status`: `recording → uploaded → processing → completed | failed`. Written by the backend only.
  The client inserts through `submitTriageScreening` (which sets `uploaded` + `pending_review` and schedules
  the pipeline); the client never writes `status`, `riskScore` or pipeline outputs.
- `screenings.reviewStatus`: `pending_review → reviewed | physical_referral`. Written **only** by
  `submitSpecialistReview`. The nurse badge derives from it (`reviewed` → Reviewed;
  `physical_referral` or `physicalReferralFlag` → Referral; no screening → No screening yet; else Awaiting
  review).

### Step 5 — Preserve authentication and identities

- Keep this app's Google OAuth client, redirect URIs and the `ConvexAuthProvider` in
  `src/components/ConvexClientProvider.tsx`.
- The UI signs in with `useSignInWithGoogle(api.auth)` from `@convex-dev/auth/methods/google/react`. That must
  produce the **same** `users` row as today, or staff profiles will not match.
- If you change the origin the UI is served from, ask before adding it to `allowedRedirectOrigins` in
  `convex/auth.ts`. Until then, serve the UI from `http://localhost:3000`.
- The UI auto-creates a nurse staff profile with hard-coded values (`helena` / `Rural PHC Field Unit` /
  `Satara`) when a signed-in user has none. Flag this to me; do not silently broaden it.

### Step 6 — Preserve the clinical behaviour

- Capture: `MediaRecorder` with `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4`, `audioBitsPerSecond:
  16000`, analyser `fftSize: 256`, auto-stop at 5 seconds. Do not change durations, formats or the analyser.
- Upload: `generateAudioUploadUrl({})` → `POST` the blob with its content type → `{ storageId }` →
  `submitTriageScreening`. Documents use the same URL then `attachPatientDocument`.
- Specialist graphs/audio: `FftSpectrumChart` renders `frequencyChartData.fftBins`; `AcousticSamplePlayer`
  plays `coughAudioUrl` / `speechAudioUrl` resolved by the backend. Preserve both, and keep the existing
  `FluidBackdrop` / `ResonanceCanvas` usage on the specialist surface.
- Nurse feedback: reads the same screening fields the specialist wrote (`specialistRemarks`,
  `approvedMedication`, `medicationApproved`, `referralInstructions`, `reviewedBy*`) via
  `getSpecialistTriageQueue` + `getPatientLogbook`. No new table, no new query.

### Step 7 — Verify (focused, one pass)

1. `npx tsc --noEmit` (or this repo's `npm run lint`) — no new errors.
2. `npm run build` — succeeds. Fix integration errors only; do not refactor unrelated code.
3. Start this app on `http://localhost:3000` and open:
   - `/` → specialist sign-in renders, no console errors;
   - `/nurse` → nurse sign-in or field unit home renders, no console errors, no horizontal overflow at 390 px.
4. Sign in with an **authorized Google test account** on an **isolated development deployment** (not
   production). If you cannot get credentials, stop and say so — do not stub authentication.
5. With **synthetic patient data only**, exercise in order: create patient → vitals/symptoms → record both
   channels → submit screening → confirm a `screenings` row with `status: "uploaded"` and
   `reviewStatus: "pending_review"` → open the specialist queue → review with `physicalReferralFlag: false` →
   confirm `reviewStatus: "reviewed"` → reopen the nurse list → confirm the feedback panel shows the remark.
   Repeat the review step once with `physicalReferralFlag: true` and confirm the row moves to referrals.
6. Confirm sign-out returns to the sign-in screen on both surfaces, and that theme switching still works on
   the specialist console.

Do not use real patients, real recordings or the production deployment. Do not claim a step passed that you
did not observe.

### Step 8 — Report back

Return a concise report with:

1. **Integration shape chosen** and why.
2. **Files added / modified / deleted** (exact paths).
3. **Contract check** — for each reference listed in Step 4, match or deviation (and what you changed on the
   frontend side).
4. **Verification results** — the commands run and their outcome, plus the observed result of each Step 7.5
   action.
5. **Backend concerns you noticed** but did not touch (role self-assignment, staff-role fallback, unscoped
   queue, 100-row cap, legacy `reviewStatus`, duplicated `convex/` trees) — list any that block the UI.
6. **Remaining blockers** and the smallest next action for the developer.
7. **Anything you deliberately did not do** because it required backend or auth changes.

Work only within the scope above. If a requirement conflicts with something you find in the repository, stop
and ask rather than guessing.

## PROMPT END

