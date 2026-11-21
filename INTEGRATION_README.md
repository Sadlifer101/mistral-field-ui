# Mistral UI — Portable Frontend Handoff

A complete, self-contained copy of the redesigned Mistral frontend (nurse field unit + specialist console)
for the original backend developer to integrate against the existing Convex backend.

| Item | Value |
| --- | --- |
| Source repository | `mistral-full` (monorepo working copy) |
| Source path | `mistral-ui-package/mistral-ui` |
| Source commit | `fddecb5` — *fix(nurse): stop nurse.html from shadowing the /nurse app route* (tree clean, no uncommitted changes) |
| Packaged on | 2026-11-21 |
| Packaging machine | Windows, Node `v22.23.2`, npm `10.9.8` |
| Files in archive | see `PACKAGE_MANIFEST.md` |
| Frontend framework | React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4 |

This package contains **only frontend code, runtime assets and documentation**. It does not contain a
backend implementation, a database, credentials, or generated data.

---

## 0. What is in the box, and what is not

**Included**

- The complete `mistral-ui` application source (`src/`, HTML entry points, `vite.config.ts`, `tsconfig.json`,
  `package.json`, lockfiles).
- The nurse mobile application (home, new entry, audio capture, screening report, patients & reviews,
  doctor feedback).
- The specialist console (dashboard, pending queue, previous reviews, patient workspace, sign-off panel,
  longitudinal logbook, acoustic playback, FFT charts).
- All custom UI components, CSS and design tokens (`src/components/specialist.css`, `src/nurse/nurse.css`,
  `src/index.css`, `src/theme/glass.ts`).
- Runtime assets: nurse meadow background video + poster, three hero/background photographs.
- The generated Convex **client** references (`convex/_generated/*.js|.d.ts`) that the frontend currently
  compiles against, plus instructions to regenerate them from your repository (§8).
- A sanitized `.env.example` (variable names, no values).
- `INTEGRATION_README.md` (this file), `FUNCTIONALITY_CHECKLIST.md`, `PACKAGE_MANIFEST.md`.

**Deliberately excluded**

| Excluded | Reason |
| --- | --- |
| `node_modules/` | Reinstall from `package-lock.json`. |
| `dist/` | Build output; produced by `npm run build`. |
| `.env.local` | Machine-specific runtime config (`VITE_CONVEX_URL` pointing at a local backend). |
| Any Convex backend source (`convex/*.ts`, `mistral-backend/`) | You already maintain the backend; the frontend must bind to it, not replace it. |
| `.convex/` local database state, uploaded audio/documents | Runtime state and patient data. |
| Google OAuth client id/secret, API keys, tokens | Secrets belong to your deployment. |
| `.git/` history | Not needed for integration. |
| UI Forge reference library | Only the components actually integrated are present (already embedded in `src/`). |
| Clara Agent app, unrelated projects | Out of scope. |

**Not verifiable in the packaging environment:** no authenticated session, no production credentials and no
real screening data were available. Nothing in this package has been executed against a real Convex
deployment. See §15 and `FUNCTIONALITY_CHECKLIST.md` for the exact distinction between *implemented*,
*verified in the authoring environment* and *unverified*.

---

## 1. Technology stack

| Layer | Package | Declared range | Resolved in lockfile |
| --- | --- | --- | --- |
| UI runtime | `react`, `react-dom` | `^19.0.1` | `19.3.1` |
| Language | `typescript` | `^7.0.2` | `7.0.2` |
| Build | `vite` | `^8.3.0` | `8.3.8` |
| React plugin | `@vitejs/plugin-react` | `^6.1.1` | from lockfile |
| Styling | `tailwindcss`, `@tailwindcss/vite` | `^4.3.3` | `4.3.5` |
| Motion | `motion` (imported as `motion/react`) | `^12.23.24` | from lockfile |
| Icons | `lucide-react` | `^0.546.0` | from lockfile |
| Backend client | `convex` | `^1.50.0` | `1.50.0` |
| Auth | `@convex-dev/auth` (+ `@auth/core`) | `^2.0.0` / `^0.41.3` | `2.0.0` / `0.41.3` |
| Headless primitives | `@radix-ui/react-select`, `@radix-ui/react-dropdown-menu` | pinned | from lockfile |

Declared but **not imported** by the frontend sources (vestigial from the original AI-Studio scaffold, safe to
drop): `@google/genai`, `express`, `dotenv`, `autoprefixer`.

Styling is Tailwind v4 (via the Vite plugin, no `tailwind.config.js` — the theme lives in `src/index.css`)
plus two hand-written stylesheets that carry the clinical design systems:

- `src/components/specialist.css` — dark-glass/plum specialist system.
- `src/nurse/nurse.css` — warm off-white / sage / olive nurse system (all classes scoped under `.nv-app`,
  tokens prefixed `--nv-*`).

The two systems are intentionally disjoint: the nurse app never imports the specialist glass/backdrop CSS.

---

## 2. Directory structure

```
MISTRAL_UI_PORTABLE/
├─ INTEGRATION_README.md          ← this file
├─ FUNCTIONALITY_CHECKLIST.md     ← feature-by-feature status
├─ PACKAGE_MANIFEST.md            ← inventory, hashes, packaging record
├─ convex/
│  └─ _generated/                 ← generated Convex *client* references (see §8)
│     ├─ api.js / api.d.ts        ← `api` / `internal` function references
│     ├─ dataModel.d.ts           ← `Id<"...">` table id types
│     └─ server.js / server.d.ts  ← query/mutation wrappers used by the generated API
└─ mistral-ui-package/
   └─ mistral-ui/                 ← the application (drop-in replacement)
      ├─ index.html               ← production entry (specialist console at `/`, nurse at `/nurse`)
      ├─ nurse.html               ← DEV-ONLY fixture harness for the nurse UI
      ├─ preview.html             ← DEV-ONLY fixture harness for the specialist console
      ├─ motion.html              ← DEV-ONLY motion/backdrop sandbox
      ├─ package.json / package-lock.json / bun.lock
      ├─ tsconfig.json            ← path aliases (see §8)
      ├─ vite.config.ts           ← aliases, preview-mode shims, `/nurse` dev rewrite
      ├─ metadata.json            ← AI-Studio scaffold metadata (no runtime effect)
      ├─ .env.example             ← sanitized environment template
      ├─ public/
      │  └─ media/
      │     ├─ meadow-8s.mp4      ← 451 KB, 720×1280, 8 s, silent, looped by the nurse home screen
      │     └─ meadow-poster.jpg  ← 30 KB poster frame (always painted first)
      └─ src/
         ├─ main.tsx              ← provider mounting (ConvexAuthProvider + ConvexReactClient)
         ├─ App.tsx               ← top-level routing/auth gates (specialist vs nurse surface)
         ├─ index.css             ← Tailwind v4 import + global tokens
         ├─ components/
         │  ├─ MobileNurseApp.tsx           ← nurse orchestrator: owns all nurse state + writes
         │  ├─ WelcomeAuthPage.tsx          ← Google sign-in / onboarding UI
         │  ├─ SpecialistConsole.tsx        ← specialist shell + queue tabs
         │  ├─ SpecialistHomeHub.tsx        ← dashboard cards
         │  ├─ SpecialistShell.tsx          ← sidebar/chrome
         │  ├─ SpecialistSignOffPanel.tsx   ← review + approval + referral form
         │  ├─ PatientDiagnosticWorkspace.tsx ← patient clinical workspace
         │  ├─ PatientDirectoryList.tsx     ← patient search list
         │  ├─ TriageQueueColumn.tsx        ← pending queue column
         │  ├─ LongitudinalLogbook.tsx      ← patient history timeline
         │  ├─ AcousticSamplePlayer.tsx     ← waveform playback of stored recordings
         │  ├─ FftSpectrumChart.tsx         ← FFT bar/line chart from `frequencyChartData.fftBins`
         │  ├─ ResonanceCanvas.tsx          ← 30 FPS resonance/telemetry canvas (specialist only)
         │  ├─ FluidBackdrop.tsx            ← specialist fluid shader backdrop
         │  ├─ TopTelemetryHeader.tsx       ← specialist header + links to the field unit
         │  ├─ SpecialistDialog.tsx / SpecialistSelect.tsx
         │  └─ specialist.css
         ├─ nurse/
         │  ├─ NurseShell.tsx / NurseHomeScreen.tsx / NurseStepRail.tsx
         │  ├─ NewEntryScreen.tsx / AudioCaptureScreen.tsx
         │  ├─ ScreeningReportScreen.tsx / PatientsReviewsScreen.tsx
         │  ├─ PatientFeedbackPanel.tsx / MeadowBackdrop.tsx
         │  ├─ contract.ts          ← frozen prop/type contract between shell and screens
         │  ├─ patientStatus.ts     ← status derivation from real screening fields
         │  ├─ CONTRACT.md          ← design/ownership notes for the nurse UI
         │  └─ nurse.css
         ├─ utils/
         │  ├─ edgeAudioRecorder.ts       ← MediaRecorder + AnalyserNode capture (5 s, 16 kbps, Opus)
         │  ├─ clinicalAcousticEngine.ts  ← local acoustic → differential / level-1 / protocol heuristics
         │  ├─ audioSynthesizer.ts        ← generated reference tones for the specialist playback UI
         │  └─ nearestFacilityLocator.ts  ← nearest-facility math + Google Maps directions deep link
         ├─ lib/clinical.ts         ← shared clinical types derived from Convex return types
         ├─ theme/glass.ts          ← specialist glass token helpers (not used by the nurse app)
         ├─ data/mockTriageData.ts  ← static demo data used only by dev previews
         ├─ preview/                ← DEV-ONLY fixture harness (shims for `convex/react` + auth)
         └─ assets/images/          ← hero/background photographs (see Appendix B)
```

---

## 3. Installation and startup

```bash
# from mistral-ui-package/mistral-ui
npm ci                      # npm is the documented workflow (package-lock.json is included)

cp .env.example .env.local  # then fill VITE_CONVEX_URL (§4)
npm run dev                 # http://localhost:3000/        specialist console
                            # http://localhost:3000/nurse    nurse field unit
```

Scripts (unchanged from the source project):

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `vite --port=3000 --host=0.0.0.0` | Normal development against Convex. |
| `dev:preview` | `vite --mode preview --port=3010 --host=0.0.0.0` | Fixture harness; no backend, no auth. |
| `build` | `vite build` | Production build (`dist/`, single `index.html` entry). |
| `preview` | `vite preview` | Serve a built `dist/`. |
| `lint` | `tsc --noEmit` | Type check only (no ESLint config is shipped). |

`bun.lock` is included for parity with the source repo, but `package-lock.json` is the reference;
`npm ci` is the supported path.

**Node**: developed and packaged on Node 22. TypeScript 7 and Vite 8 expect a current LTS.
**Browser**: Chromium-based browsers were used for visual verification; the capture path uses
`MediaRecorder` + Web Audio and needs a secure context (HTTPS or `localhost`).

---

## 4. Environment variables

Frontend variables are Vite variables (they end up in the browser bundle — treat them as public):

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `VITE_CONVEX_URL` | frontend | **yes** | HTTP URL of your Convex deployment, e.g. `https://<deployment>.convex.cloud`. Passed to `new ConvexReactClient(...)` in `src/main.tsx`. |

Backend/deployment variables referenced by the existing `convex/auth.ts` (must exist **on your Convex
deployment**, never in this frontend):

| Variable | Required by | Notes |
| --- | --- | --- |
| `AUTH_GOOGLE_CLIENT_ID` | `convex/auth.ts` | Google OAuth web client id. |
| `AUTH_GOOGLE_CLIENT_SECRET` | `convex/auth.ts` | Google OAuth client secret. |
| `CONVEX_SITE_URL` | `convex/auth.ts`, `convex/http.ts` | Provided by Convex; used in `allowedRedirectOrigins`. |
| `GEMINI_API_KEY` | backend AI pipeline (if enabled) | **Not** read by this frontend; no client-side Gemini call exists. |
| `APP_URL` | deployment metadata (AI-Studio scaffold) | Not read by this frontend. |

`.env.example` in the app folder lists the same names with empty values. No credentials are included.

---

## 5. Authentication (existing Google OAuth / Convex Auth integration)

The frontend uses the existing `@convex-dev/auth` Google flow. Nothing in this package changes backend auth.

**Provider wiring — `src/main.tsx`**

```tsx
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

<ConvexAuthProvider
  client={convex}
  api={{
    refreshSession: api.auth.refreshSession,
    signOut: api.auth.signOut,
    isAuthenticated: api.auth.isAuthenticated,
  }}
>
  <App />
</ConvexAuthProvider>
```

`api.auth.*` resolves to the **backend's existing** `convex/auth.ts` exports
(`signOut`, `refreshSession`, `isAuthenticated`, plus `startSignInWithGoogle` / `completeSignInWithGoogle`
attached by `setupGoogle`). If your `auth.ts` exports different names, update the three references in
`src/main.tsx` only.

**Sign-in call site — `src/components/WelcomeAuthPage.tsx`**

```tsx
const { signIn } = useSignInWithGoogle(api.auth);   // @convex-dev/auth/methods/google/react
…
void signIn();                                       // opens the Google consent flow
```

**Backend prerequisites** (in `convex/auth.ts`, for your review — not shipped here):

- `Google({ clientId: env.AUTH_GOOGLE_CLIENT_ID, clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET })`.
- `setupGoogle(authCore, { component: components.authGoogle, allowedRedirectOrigins: [env.CONVEX_SITE_URL, "http://localhost:3000"] })`
  — the hard-coded `http://localhost:3000` origin is why sign-in is rejected on `127.0.0.1`, on a LAN IP
  (phone testing) or on any other port.
- `attachUserCallbacks({ createUser: internal.users.createUserGoogle })`.

**Session state used by the UI**: `useConvexAuth()` → `{ isAuthenticated, isLoading }`. The UI has no other
authentication path: the email/password form fields on the sign-in card are an intentional stub that displays
"Email and password sign-in is not connected…" and never calls a mutation.

**Known environment limitation (authoring machine)**: the local deployment used during development only had
placeholder Google credentials, so Google sign-in ended at Google with `401 invalid_client`, and no
authenticated session could be established for testing. See §15.

---

## 6. Convex client configuration

- Client construction: `src/main.tsx` — `new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)`.
- No custom WebSocket options, no offline queue, no optimistic local cache beyond Convex's own client cache.
- Connection UI reads `useConvexConnectionState()` (nurse header pill) combined with `navigator.onLine`:

  | Condition | Nurse sync pill |
  | --- | --- |
  | browser offline | `Offline` |
  | socket connected | `Synced` |
  | otherwise | `Connecting` |

  The indicator only ever reflects those real signals; there is no simulated "Synced" state.
- Auth-gated queries use Convex's `"skip"` sentinel (see §10), never a disabled component.

---

## 7. Connecting the frontend to your existing Convex deployment

1. **Point the client at your deployment**

   ```bash
   echo 'VITE_CONVEX_URL=https://<your-deployment>.convex.cloud' > .env.local
   ```

2. **Regenerate the client references from your backend** (see §8). In the repository that holds your
   `convex/` directory:

   ```bash
   npx convex dev      # or: npx convex codegen
   ```

   This rewrites `convex/_generated/{api.js,api.d.ts,dataModel.d.ts,server.js,server.d.ts}`.

3. **Make sure the alias target and the generated files line up** — `@convex/*` must resolve to *your*
   `convex/_generated/*` (see §8 for the exact path arithmetic and how to change it if your layout differs).

4. **Keep the deployment's env vars** (`AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET`) and add the
   origin you serve the UI from to `allowedRedirectOrigins` if it is not `http://localhost:3000`.

No other configuration is required; the frontend has no server of its own, no proxy and no build-time code
generation beyond Vite/Tailwind.

---

## 8. Source aliases and generated API references

Two aliases matter:

| Alias | Defined in | Resolves to | Used for |
| --- | --- | --- | --- |
| `@convex` / `@convex/*` | `vite.config.ts` (`resolve.alias`) and `tsconfig.json` (`compilerOptions.paths`) | `../../convex/_generated/*` | `import { api } from "@convex/api"`, `import type { Id } from "@convex/dataModel"` |
| `@` / `@/*` | `tsconfig.json` only | `./*` (app root) | Optional absolute imports; the current sources mostly use relative paths. |

**Path arithmetic** (this is why the archive has the folder shape it has):

```
<package root>/convex/_generated          ← generated client references
<package root>/mistral-ui-package/mistral-ui/   ← app
                        └── ../../  → <package root>
```

If you extract the app to a different depth, update **both**:

- `vite.config.ts` → `{ find: '@convex', replacement: path.resolve(__dirname, '../../convex/_generated') }`
- `tsconfig.json` → `"@convex/*": ["../../convex/_generated/*"]`

**What `_generated` is, and what it is not**

- `api.js` re-exports `anyApi` from `convex/server` — it is a runtime *reference factory*, not a backend.
  The app imports `api` from it at runtime, so the file must be present for a build.
- `api.d.ts` and `dataModel.d.ts` are type-only. They `import type` your backend modules
  (`../triageLogbook.js`, `../schema.js`, `../aiPipeline.js`, …). Therefore:

  > **Type checking (`npm run lint`) requires the sibling backend modules.** In this archive only
  > `convex/_generated` is present, so `tsc --noEmit` will report missing-module errors until you
  > regenerate inside your own repository (where `convex/triageLogbook.ts`, `convex/schema.ts`, … exist).
  > The runtime build (`vite build`) does not read `.d.ts` files and builds without them.

- The generated files in the archive were produced by the source backend the frontend was developed against.
  They are **not** a substitute for your own codegen and contain no backend logic.

`src/preview/*` shims are a **development-only** substitute for `convex/react` and are applied only when
Vite runs with `--mode preview`. They never ship in a production build and must not be used as an
integration layer.

---

## 9. Entry points

| URL | Served by | What renders |
| --- | --- | --- |
| `/` | `index.html` → `src/main.tsx` | Specialist console (after auth) or the sign-in/onboarding screen. |
| `/nurse` | same `index.html` (path check in `App.tsx`) | Nurse field unit (after auth) or the compact nurse sign-in card. |
| `/nurse/` | same | Same as above. |
| `/nurse.html` | `nurse.html` → `src/preview/main.tsx` | **DEV ONLY** fixture harness for the nurse UI (`npm run dev:preview`). |
| `/preview.html` | `preview.html` | **DEV ONLY** fixture harness for the specialist console. |
| `/motion.html` | `motion.html` | **DEV ONLY** backdrop/motion sandbox. |

`vite build` emits a **single** `index.html` entry; the three harness pages are never part of a production
build.

**Dev-server note**: because `nurse.html` exists at the project root, Vite's HTML fallback would resolve the
extension-less `/nurse` route to that harness and shadow the real app. `vite.config.ts` therefore contains a
dev-only middleware (`nurse-route-entry`) that rewrites `/nurse` to `/index.html`. Keep it, or rename/remove
`nurse.html`, if you restructure the project.

**Production hosting note**: the deployment must serve `index.html` for `/nurse` (SPA rewrite / fallback),
exactly as it already must for `/`. A static host without a fallback will 404 the nurse route while the
harness-free build otherwise works.

---

## 10. Routing and authentication gates

All routing is pathname-based inside `src/App.tsx`; there is no router dependency.

```ts
const readNurseSurface = () => /^\/nurse(?:[./]|$)/.test(window.location.pathname);
```

Gate order in `App`:

1. `nurseSurface && isAuthenticated` → if the nurse staff profile is still loading or missing, render
   "Opening PHC field unit…"; once present, render `<MobileNurseApp nurse={profile} onSignOut={...} />`.
2. Not authenticated → `<WelcomeAuthPage compact={nurseSurface} />` (compact = nurse sign-in card,
   full = specialist sign-in page).
3. Authenticated specialist with `getMyStaffProfile({role:"city_specialist"}) === null` → specialist
   onboarding form (`upsertStaffProfile`, role `city_specialist`).
4. Otherwise → `<SpecialistConsole … />`.

Queries are auth-gated with `"skip"`, e.g.:

```tsx
useQuery(api.triageLogbook.getMyStaffProfile, isAuthenticated && !nurseSurface ? { role: "city_specialist" } : "skip")
```

**Nurse profile bootstrap (for your review)**: if the signed-in user has no `nurse` staff profile, the client
auto-creates one with hard-coded values (`mobileNurseApp` effect and `App` effect):

```ts
upsertStaffProfile({ role: "nurse", fullName: nurse.fullName || "helena",
                     facilityName: "Rural PHC Field Unit", district: "Satara" })
```

This is a carry-over from the original implementation and lets a brand-new Google account into the field unit
without an onboarding screen. If you require explicit nurse onboarding, this is the code to change
(`src/App.tsx` and `src/components/MobileNurseApp.tsx`).

The specialist header links to the nurse surface with `<a href="/nurse">`, so both surfaces are reachable from
one deployment.

---

## 11. Convex contract map (functions the frontend actually calls)

13 references, all in the `triageLogbook` and `auth` modules. Signatures below are copied from the backend
source the frontend was built against (`convex/triageLogbook.ts`, `convex/auth.ts`).

| # | Function | Kind | Arguments (validators) | Returns | Frontend call sites |
| --- | --- | --- | --- | --- | --- |
| 1 | `triageLogbook.getMyStaffProfile` | query | `{ role?: "nurse" \| "primary_doctor" \| "city_specialist" }` | `staffProfiles \| null` | `App.tsx:29,33` (specialist + nurse gates), `MobileNurseApp.tsx:83`, `SpecialistSignOffPanel.tsx:77` |
| 2 | `triageLogbook.upsertStaffProfile` | mutation | `{ role, fullName: string, facilityName: string, district: string, hprRegistrationId?: string, phoneNumber?: string }` | `Id<"staffProfiles">` | `App.tsx:27` (nurse bootstrap), `App.tsx:138` (specialist onboarding), `MobileNurseApp.tsx:84` |
| 3 | `triageLogbook.searchOrListPatients` | query | `{ search?: string }` | `patients[]` | `PatientDirectoryList.tsx:15`, `NewEntryScreen.tsx:146` (existing-patient mode), `PatientsReviewsScreen.tsx:118` |
| 4 | `triageLogbook.createLogbookPatient` | mutation | `{ fullName, age: number, sex: "M"\|"F"\|"O", village, preferredLang: "hi"\|"en"\|"mr"\|"ta"\|"te"\|"bn"\|"kn", smokingHistory: boolean, phone?: string, chronicConditions?: string[] }` | `Id<"patients">` | `MobileNurseApp.tsx:86` → called in `handleDispatch` |
| 5 | `triageLogbook.generateAudioUploadUrl` | mutation | `{}` | `string` (storage upload URL) | `MobileNurseApp.tsx:85` → `uploadBlob`, `handleAttach` |
| 6 | `triageLogbook.submitTriageScreening` | mutation | `{ patientId: Id<"patients">, coughAudioId: Id<"_storage">, speechAudioId: Id<"_storage">, rawAudioBytes?, compressedAudioBytes?, compressionRatio?, frequencyChartData?, symptomNotes?, spo2Percent?, respiratoryRate?, temperatureC?, provisionalMedication?, aiClinicalBrief?, rawTranscript?, translatedEnText?, level1Status?, predictedConditions? }` | `Id<"screenings">` | `MobileNurseApp.tsx:87` → `handleDispatch` |
| 7 | `triageLogbook.getPatientLogbook` | query | `{ patientId: Id<"patients"> }` | `{ patient, screenings[], documents[] }` (audio + document URLs resolved server-side) | `PatientDiagnosticWorkspace.tsx:55`, `PatientFeedbackPanel.tsx:486` |
| 8 | `triageLogbook.attachPatientDocument` | mutation | `{ patientId, screeningId?: Id<"screenings">, fileId: Id<"_storage">, fileName: string, docType: "xray"\|"lab_report"\|…, notes?: string }` | `Id<"patientDocuments">` | `MobileNurseApp.tsx:88` → `handleAttach` (report screen only) |
| 9 | `triageLogbook.getSpecialistTriageQueue` | query | `{ statusFilter?: "pending_review"\|"reviewed"\|"physical_referral" }` | `Array<{ screening, patient }>` | `SpecialistConsole.tsx:185` (client passes `{}`), `PatientsReviewsScreen.tsx:123` (nurse "Doctor Reviews" tab) |
| 10 | `triageLogbook.submitSpecialistReview` | mutation | `{ screeningId, specialistRemarks: string, physicalReferralFlag: boolean, referralInstructions?, provisionalMedication?, medicationApproved?: boolean, approvedMedication?, reviewedByName?, reviewedByPhone?, reviewedByFacility?, reviewedByDistrict? }` | `null` | `SpecialistSignOffPanel.tsx:78` → `submitReview` |
| 11 | `auth.refreshSession` | action | — | session | `main.tsx:14` (provider `api` prop) |
| 12 | `auth.signOut` | action | — | — | `main.tsx:15` |
| 13 | `auth.isAuthenticated` | query | — | `boolean` | `main.tsx:16` |

**Writes are confined to two places**: `MobileNurseApp.tsx` (nurse: staff bootstrap, patient, screening,
document) and `SpecialistSignOffPanel.tsx` (specialist review) — plus the specialist onboarding form in
`App.tsx`. Screens are presentational and receive callbacks.

**State machines preserved**

- Screening lifecycle: backend sets `status: "uploaded"` and `reviewStatus: "pending_review"` on insert; the
  AI pipeline may advance `status`/`riskScore`/`level1Status` asynchronously (server-side scheduler —
  `internal.aiPipeline.processScreening` is called by the mutation, never by the client).
- Review lifecycle: only `submitSpecialistReview` writes `reviewStatus`
  (`physicalReferralFlag ? "physical_referral" : "reviewed"`).
- The nurse UI derives its badge purely from those fields (`src/nurse/patientStatus.ts`):
  `reviewed` → "Reviewed"; `physical_referral || physicalReferralFlag` → "Referral"; null screening →
  "No screening yet"; otherwise "Awaiting review".

---

## 12. Audio upload and screening submission flow

Capture (`src/utils/edgeAudioRecorder.ts`, `src/nurse/AudioCaptureScreen.tsx`)

1. `getUserMedia({ audio: true })`; errors are mapped to human messages (includes an HTTPS/localhost hint).
2. `MediaRecorder` with the first supported MIME of `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4`,
   `audioBitsPerSecond: 16000`.
3. `AnalyserNode` (`fftSize: 256`, `smoothingTimeConstant: 0.65`) drives the live bar visualisation.
4. Capture stops automatically after **5 seconds** (`CAPTURE_SECONDS = 5`) and returns
   `CaptureResult { blob, mimeType, durationSeconds, objectUrl, compressedAudioBytes, frequencyChartData }`.
   The `frequencyChartData` is computed locally (FFT bins, fundamental frequency, spectral centroid,
   zero-crossing rate, peak RMS).
5. Playback uses a real `HTMLAudioElement` on the object URL — no synthetic audio for real recordings.

Submit (`MobileNurseApp.handleDispatch`, in order)

1. New patient → `createLogbookPatient({...})` with
   `preferredLang` inferred from the notes script (`detectPreferredLang`) and vitals/symptom text folded into
   `chronicConditions` (string[]).
2. Both blobs upload **in parallel**: `generateAudioUploadUrl({})` → `POST <url>` with the blob and its
   content type → `{ storageId }`.
3. Local clinical analysis (`analyzeClinicalAcoustics`) produces `probabilities`, `level1`, `protocol.lines`,
   `brief.synthesis`, `brief.translation`; the report screen renders it immediately.
4. `submitTriageScreening({...})` sends: patient id, both storage ids, byte counts, merged
   `frequencyChartData` (cough bins/centroid/ZCR + phonation fundamental frequency + max peak RMS), optional
   vitals, symptom notes (also sent as `rawTranscript`), `provisionalMedication`, `aiClinicalBrief`,
   `translatedEnText`, `level1Status`, `predictedConditions[{label, confidence}]`.
5. On success the returned `screeningId` unlocks the document attach control; on failure the error message is
   shown on the report screen and nothing is claimed as saved.

Document upload (`handleAttach`): `generateAudioUploadUrl` → `POST` file → `attachPatientDocument`
(`docType` guessed: image/x-ray name or `image/*` → `xray`, else `lab_report`).

The nurse UI never reports success it did not receive: there is no offline queue, no local persistence and no
retry loop.

---

## 13. Specialist review and referral flow

1. `getSpecialistTriageQueue({})` returns the newest 100 screenings joined with patients, sorted
   referral-flagged first and then by `riskScore` descending (backend behaviour, not client sorting).
2. The console derives its tabs from that single result: Pending (`reviewStatus === "pending_review"`),
   Previous (`reviewed`), Referrals (`physical_referral` or `physicalReferralFlag`) — no extra queries.
3. Selecting a patient loads `getPatientLogbook({ patientId })` for history, documents and audio URLs.
4. Review form (`SpecialistSignOffPanel`) → `submitSpecialistReview`:

   ```ts
   await submitReview({
     screeningId,
     specialistRemarks: remarks.trim(),
     physicalReferralFlag,
     ...(instructions ? { referralInstructions: instructions } : {}),
     ...(approveMedication && medication ? { approvedMedication: medication } : {}),
     medicationApproved: approveMedication,
     ...(specialist?.fullName ? { reviewedByName: specialist.fullName } : {}),
   });
   ```

5. The nurse side sees the outcome through the queue fields (`specialistRemarks`, `approvedMedication`,
   `medicationApproved`, `referralInstructions`, `reviewedBy*`) rendered by `PatientFeedbackPanel` — it never
   needs a specialist-only query.

---

## 14. Integrating the UI without replacing the backend

The package is designed to be **dropped in beside** your `convex/` directory, not instead of it.

1. Copy `mistral-ui-package/mistral-ui` into your repository (keep the `mistral-ui-package/` parent, or adjust
   the two alias definitions as described in §8).
2. Run `npx convex dev` in your repository to regenerate `convex/_generated` from **your** backend.
3. Compare your functions with §11. The UI compiles against those exact names, argument keys and return
   shapes, because it derives its types from `api.*` (`FunctionReturnType<typeof api…>`). If a mismatch exists:

   - **Renamed function** → update the `api.<module>.<name>` reference (13 call sites, listed in §11).
   - **Different argument key** → update the call site; the argument objects are assembled in
     `MobileNurseApp.handleDispatch` / `handleAttach`, `App` (staff profile), and
     `SpecialistSignOffPanel.submitReview`.
   - **Different return shape** → the UI reads specific fields (`screening.reviewStatus`,
     `screening.physicalReferralFlag`, `screening.specialistRemarks`, `screening.approvedMedication`,
     `screening.level1Status`, `screening.riskScore`, `screening.probabilities`/`predictedConditions`,
     `screening.frequencyChartData.fftBins`, `patient.fullName/age/sex/village/patientCode`,
     `documents[].fileUrl`, `screenings[].coughAudioUrl/speechAudioUrl`).
   - **No adapter layer is included, by design** — the UI binds to your contract directly rather than
     inventing a second one. No backend bindings have been fabricated here.

4. Keep backend responsibilities with you: schema and migrations, Google OAuth credentials, staff-role
   authorization, patient access rules, clinical/AI processing, deployment and production configuration.
   The frontend writes only what §11 lists, through the mutations above.

---

## 15. Known limitations and unverified functionality

### Integration-blocking (must be resolved by the backend developer)

1. **No authenticated end-to-end run has ever been performed against a real deployment.** The authoring
   environment's local Convex deployment held placeholder Google credentials, so Google sign-in failed at
   Google (`401 invalid_client`) and no session could be created. Every authenticated write path is
   therefore **implemented and type-checked, but unverified end to end**. Do not read the checklist as a test
   report.
2. **`allowedRedirectOrigins` is hard-coded** to `[env.CONVEX_SITE_URL, "http://localhost:3000"]` in
   `convex/auth.ts`. Serving the UI on another port, `127.0.0.1`, or a LAN IP (phone demo) makes Google
   sign-in throw `redirectTo origin "…" is not in allowedRedirectOrigins`.
3. **Type checking needs your backend sources** (§8). In this archive alone, `tsc --noEmit` cannot resolve
   `../triageLogbook.js` / `../schema.js` imports from `api.d.ts`.
4. **Nurse staff profile is auto-created** with hard-coded name/facility/district if missing (§10).
5. **Patient code collisions are possible**: `createLogbookPatient` generates `SV-` + a random 4-digit suffix
   with no uniqueness check.

### Authorization / pagination issues to review (unchanged, no fixes applied here)

- `searchOrListPatients`, `getPatientLogbook`, `getSpecialistTriageQueue` gate on *authentication only*
  (`requireUserId`) — any signed-in user (nurse or specialist) can read every patient and screening. There is
  no role check on reads and no per-facility scope.
- `searchOrListPatients` lists the newest 30 patients, and its search path scans the newest 100 and merges
  index hits before truncating to 30. No pagination.
- `getPatientLogbook` reads up to 100 screenings for the patient's owner and filters by `patientId` in memory;
  documents capped at 50. No pagination.
- `getSpecialistTriageQueue` caps at 100 rows, unscoped by specialist/facility, and sorts in memory.
- `submitSpecialistReview` accepts `reviewedByName/Phone/Facility/District` from the client (they win over the
  staff profile), so the reviewer identity shown on a review is client-supplied.
- `upsertStaffProfile` accepts `role` from the client, so a signed-in user can self-assign
  `city_specialist`/`primary_doctor`/`nurse`.
- `attachPatientDocument` and `submitTriageScreening` require a `nurse` staff profile; a specialist hitting
  those paths gets "Staff profile is required".

### Frontend limitations (intentional, carried into this package)

- **No drafts and no offline support.** Patient data is never written to `localStorage`/IndexedDB. Closing
  the tab loses an in-progress entry; there is no retry queue. The UI never shows a success it did not receive.
- **5-second capture** per channel (unchanged clinical protocol); the design mock-ups' longer illustrative
  durations were intentionally not adopted.
- **No patient-ID input** — the backend mints `patientCode`; there is no patient identifier field in the form.
- `phone` is optional and only sent when filled.
- **Symptom chips** append words into the existing `symptomNotes` free text; they do not create a new payload
  field.
- **Status vocabulary** is limited to what the schema stores (No screening yet / Awaiting review / Reviewed /
  Referral). No "Draft"/"Submitted" states exist.
- The nurse "Doctor Reviews" tab reads the **specialist** queue (unscoped, capped at 100); a per-patient
  status endpoint would be the durable fix.
- Nurse tab labels wrap to two lines below 360 px; the search placeholder clips slightly at 320 px; the sticky
  footer overlays the last list row until scroll. Landscape layout was not verified.
- Microphone permissions, iOS Safari behaviour, real 2G/3G throttling, object-URL playback on physical devices
  and document capture (`capture="environment"`) were not exercised.
- `preview.html`, `nurse.html`, `motion.html`, `src/preview/*`, `src/data/mockTriageData.ts` and
  `src/utils/audioSynthesizer.ts` are development/demo helpers. They contain **synthetic** data only and must
  never be wired to a real deployment.
- `metadata.json` (AI-Studio scaffold) and the unused `@google/genai`, `express`, `dotenv`, `autoprefixer`
  dependencies have no runtime role.

---

## Appendix A — UI Forge provenance

Components in this package that were adapted from the UI Forge reference vault (only the specific behaviours
were reused; no Forge library is bundled):

| Forge id | Source files consulted | What was reused | Where it lives now |
| --- | --- | --- | --- |
| `atelier-vale/cinematic-hero` | `packages/boilerplates/atelier-vale-hero/src/components/FilmFrame.tsx`, `src/hooks/useHeroLoop.ts`, `src/media.ts`, `src/components/Reveal.tsx` | poster-under-film layering, three-state media load, silent-loop video element settings, play-rejection handling, easing curve | `src/nurse/MeadowBackdrop.tsx`, `src/nurse/nurse.css` |
| `editorial-stagger` | `packages/motion/editorial-stagger/index.tsx` | stagger variants, `initial={settled ? false : "hidden"}`, reduced-motion collapse | `src/nurse/NurseHomeScreen.tsx` |
| `liquid-glass` | `packages/effects/liquid-glass/styles.css` | inspected only for the reduced-transparency fallback; **no glass styling was adopted in the nurse UI** | — |
| `shadcn` primitives | vault reference | behaviour reference for the two Radix wrappers | `src/components/SpecialistSelect.tsx`, `SpecialistDialog.tsx` |

The nurse design system (`src/nurse/nurse.css`) is original work built to the approved reference designs.

## Appendix B — Assets and licensing

| Asset | Size | Used by | Provenance |
| --- | --- | --- | --- |
| `public/media/meadow-8s.mp4` | 451 KB, 720×1280, 8 s, silent | Nurse home background (looped) | Generated for this project from a supplied meadow clip; re-encoded locally |
| `public/media/meadow-poster.jpg` | 30 KB | Nurse background poster frame | Frame extracted from the same clip |
| `src/assets/images/hero_botanical_meadow_*.jpg` | ~890 KB / ~912 KB | Specialist `ResonanceCanvas` day/night artwork | Generated for this project |
| `src/assets/images/nurse_bg.jpg` | ~890 KB | Nurse sign-in card background | Generated for this project |
| Fonts | — | Both surfaces | Loaded from Google Fonts via `<link>` in the HTML entry points (Cormorant Garamond, IBM Plex Mono, Plus Jakarta Sans). **No font binaries are bundled**, so redistribution is governed by the Google Fonts licence terms; substitute local fonts if the target deployment must be offline. |

No third-party clinical imagery, patient photographs or recordings are included. Preview/demo data in
`src/data/mockTriageData.ts` and `src/preview/previewData.ts` is synthetic.

## Appendix C — Verification performed for this package

See `PACKAGE_MANIFEST.md` for the exact commands, results and checksums. In short: archive integrity and
extraction were checked, the staged file set was reviewed against the source tree, a clean `vite build` was
run from the extracted archive, and `tsc --noEmit` was run against the extracted archive *with* the backend
sources present for type resolution (type-check support file — not shipped). No claim is made that the
transferred application has been tested against your backend.
