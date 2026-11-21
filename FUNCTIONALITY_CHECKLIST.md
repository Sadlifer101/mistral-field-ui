# Functionality Checklist — Mistral Frontend

Scope: the frontend in this repository (`mistral-ui-package/mistral-ui`), against the existing Convex contract
documented in [`CONVEX_CONTRACT_MAP.md`](./CONVEX_CONTRACT_MAP.md). Setup and verification steps live in
[`INTEGRATION_CHECKLIST.md`](./INTEGRATION_CHECKLIST.md).

## How to read the status column

| Status | Meaning |
| --- | --- |
| **VERIFIED** | The behaviour was exercised in a real browser during development, against the data source named in the *Evidence* column. |
| **IMPLEMENTED** | The code path exists and type-checks against the backend contract, but has not been exercised against a real Convex deployment. |
| **PARTIAL** | The client half was exercised (e.g. against the fixture harness or a stubbed upload), but the real backend half was not. |
| **BLOCKED** | Could not be exercised in the authoring environment for an environment reason (stated), not because the UI is missing. |
| **NOT IMPLEMENTED** | No code path exists; the UI does not pretend otherwise. |

**Two constraints apply to every row below, and must not be read past:**

1. No authenticated session was ever established against a real Convex deployment. The authoring machine's
   local deployment had placeholder Google credentials, so `Continue with Google` reached Google and returned
   `401 invalid_client`. Every authenticated read/write path is therefore *implemented and type-checked*, and
   at best exercised against the dev fixture harness (`src/preview/*`, synthetic data, no backend).
2. Nothing here is a substitute for your own integration test against your deployment.

---

## Nurse field unit (`/nurse` → `MobileNurseApp`)

| Feature | Status | Evidence / notes |
| --- | --- | --- |
| Google sign-in (nurse surface) | **BLOCKED** | Sign-in button and flow are wired (`useSignInWithGoogle(api.auth)`); the local backend answered with a placeholder OAuth client, so Google rejected it (`invalid_client`). Not a UI defect — needs real credentials on your deployment. |
| Sign-in screen (nurse variant) | **VERIFIED** | Rendered at `/nurse` in a real browser at 390×844, compact card variant, no console errors (other than the OAuth/favicon 404). |
| Patient creation (`createLogbookPatient`) | **IMPLEMENTED** | Payload assembled in `MobileNurseApp.handleDispatch`; validated against the mutation's validators by code review. No authenticated run. Client-side gate: name > 1 char, age integer 1–120, village non-empty. |
| Patient search (`searchOrListPatients`) | **IMPLEMENTED** | Debounced search + roster list in `NewEntryScreen` (existing-patient mode) and `PatientsReviewsScreen`. UI interaction verified with fixture rows; live query unverified. |
| Patient information fields | **VERIFIED** (UI) | Name, age, sex (F/M/O segmented), village, optional phone. Interaction and layout verified at 320–430 px in the fixture harness. |
| Vitals | **VERIFIED** (UI) | SpO₂, respiratory rate, temperature inputs with validation messaging; values are passed through as optional numbers. |
| Symptoms | **VERIFIED** (UI) | Free-text notes plus symptom chips that append words into the same `symptomNotes` string (no new payload field). |
| Cough recording | **VERIFIED** | 5-second auto-stop, live analyser bars, Opus/WebM (`audioBitsPerSecond: 16000`), real `MediaRecorder`. Exercised in Chromium with a fake microphone device. |
| Voice recording | **VERIFIED** | Same recorder, second channel, independent state. |
| Audio playback (frontend) | **VERIFIED** | Real `HTMLAudioElement` over the recorded object URL; play/pause/retry exercised. |
| Audio upload (both channels) | **PARTIAL** | `generateAudioUploadUrl({}) → POST blob → { storageId }` implemented; the upload was executed against a stubbed URL in the harness only. Real Convex storage upload unverified. |
| Screening submission (`submitTriageScreening`) | **PARTIAL** | Full payload construction (byte counts, merged `frequencyChartData`, vitals, notes, provisional medication, brief, translation, level 1, predicted conditions) executed in the harness against the simulated mutation. Never sent to a real deployment. |
| Acoustic analysis shown on the report | **VERIFIED** (local engine) | `analyzeClinicalAcoustics` runs entirely client-side from the captured FFT data and vitals; report screen rendered with 4 probability bars, level-1 badge, waiting-for-approval state. |
| Patient records (Patients tab) | **VERIFIED** (UI) | Roster list with real status badges derived from queue/screening fields (`patientStatus.ts`); verified with fixtures, including the two-line name clamp and date/badge stacking. |
| Doctor feedback (feedback panel) | **VERIFIED** (UI) | "Doctor Feedback" panel renders below the list with Specialist remark / Approved treatment / Referral rows + reviewing doctor + differential + nearest facility; verified with fixture data (3 KV rows). |
| Documents (attach x-ray / lab report) | **PARTIAL** | `handleAttach` → `generateAudioUploadUrl` → `POST` → `attachPatientDocument` (`docType` guessed from name/MIME). Exercised with a synthetic file against the stubbed upload. Real storage/DB unverified. |
| Patient history (nurse side) | **VERIFIED** (UI) | "Open patient" loads `getPatientLogbook` in the feedback panel; rendered with fixtures. |
| Offline / draft behaviour | **NOT IMPLEMENTED** | Deliberate: patient data is never persisted to browser storage, there is no offline queue and no retry. Closing the tab loses an in-progress entry. The sync pill only reports real socket/`navigator.onLine` state (`Offline` / `Connecting` / `Synced`). |
| Recordings survive navigation | **VERIFIED** | Intake state and both captures live in `MobileNurseApp`; navigating Home → Patients & Reviews → New Entry keeps them (and revokes object URLs only on replace/clear/unmount). |
| Responsive layout | **VERIFIED** | 36 scene × viewport measurements (home, entry, audio, patients, feedback, report) at 320/360/375/390/414/430/768 px in Chrome device emulation: no horizontal overflow, no clipped controls, no console errors. Landscape not verified. |
| Theme | n/a | The nurse surface uses a fixed warm light design system by design; no dark variant. |

---

## Specialist console (`/` → `SpecialistConsole`)

| Feature | Status | Evidence / notes |
| --- | --- | --- |
| Google sign-in (specialist surface) | **BLOCKED** | Same credential limitation as the nurse surface. |
| Sign-in / onboarding screens | **VERIFIED** (UI) | Rendered in a real browser; the specialist onboarding form posts `upsertStaffProfile` with `role: "city_specialist"` (call implemented, never executed against a live deployment). |
| Dashboard | **VERIFIED** (UI) | Shell, telemetry header, home hub cards rendered in the authoring environment. |
| Pending queue (`getSpecialistTriageQueue`) | **VERIFIED** (UI, fixtures) / **UNVERIFIED** (live) | Tabs derive from one queue query; sorting is server-side (referral first, then risk score). Live query never executed. |
| Previous reviews | **VERIFIED** (UI, fixtures) | Derived client-side from the same queue (`reviewStatus === "reviewed"`); no separate query. |
| Physical referrals | **VERIFIED** (UI, fixtures) | Derived from `reviewStatus === "physical_referral"` or `physicalReferralFlag`. |
| Patient selection | **VERIFIED** (UI) | Selecting a queue row opens the diagnostic workspace and triggers `getPatientLogbook`. |
| Clinical assessments | **IMPLEMENTED** | Reads backend-provided fields (risk score, level 1 status, predicted conditions, differential) and renders them; never recomputes clinical probability server-side values on the client. Live data unverified. |
| Interactive waveforms | **VERIFIED** (authoring env, synthetic audio) | Waveform playback component restored and exercised with synthetic/fixture audio; **unverified** with real `coughAudioUrl`/`speechAudioUrl` from Convex storage. |
| FFT charts | **VERIFIED** (fixtures) | `FftSpectrumChart` renders from `screening.frequencyChartData.fftBins`; exercised with fixture frequency data. |
| Audio playback (stored recordings) | **PARTIAL** | Playback logic + UI verified with fixture audio; backend URL playback unverified (blocked by auth). |
| Patient history (logbook) | **VERIFIED** (UI, fixtures) | `LongitudinalLogbook` timeline from `getPatientLogbook.screenings`. |
| Patient documents | **IMPLEMENTED** | Document list with `fileUrl` + doc type; rendered from fixtures, live storage URLs unverified. |
| Specialist review (`submitSpecialistReview`) | **IMPLEMENTED** | Form + payload verified by code review; never executed against a live deployment. |
| Treatment approval | **IMPLEMENTED** | `medicationApproved` / `approvedMedication` switches in `SpecialistSignOffPanel`. |
| Referral actions | **IMPLEMENTED** | `physicalReferralFlag` + `referralInstructions`, with mandatory-referral warning copy. |
| Sign-out | **IMPLEMENTED** | `useAuthActions().signOut()` → `api.auth.signOut`; blocked by the same auth limitation. |
| Theme switching (light/dark) | **VERIFIED** | Toggle persists to `localStorage` key `mistral_theme` and flips the `dark` class; exercised in a browser. |
| Fluid backdrop / resonance canvas | **VERIFIED** (rendering) | Specialist-only; canvas/shader renders and animates. Not used by the nurse surface. |

---

## Build and static validation

| Check | Result | Notes |
| --- | --- | --- |
| `npm run lint` (`tsc --noEmit`) in the source project | **PASS** (exit 0) | Run before packaging on the exact tree that was packaged. |
| `npx vite build` from the extracted archive | see `PACKAGE_MANIFEST.md` | Runtime module graph, Tailwind and asset emission. |
| `tsc --noEmit` from the extracted archive | see `PACKAGE_MANIFEST.md` | Required the backend sources for `api.d.ts` module resolution (type-check helper, not shipped). |
| Secret scan of packaged files | **PASS** | No API keys, OAuth secrets, tokens or `.env.local` in the archive. |
| Archive extraction / inventory | see `PACKAGE_MANIFEST.md` | |

---

## Summary

- **VERIFIED in a real browser**: nurse UI screens and interactions, capture with a fake microphone, local
  acoustic report, patients/reviews UI with fixtures, specialist rendering and playback with fixtures, theme
  switching, responsive behaviour at 7 widths, production build of the packaged tree.
- **IMPLEMENTED, NOT EXERCISED END TO END**: every authenticated read and every mutation (patient creation,
  screening submission, document attach, specialist review, referral, staff profile upsert).
- **BLOCKED**: Google sign-in (no real OAuth credentials on the authoring deployment) — which is also why the
  whole authenticated surface could not be tested live.
- **NOT IMPLEMENTED (by design)**: drafts, offline queue, patient data in browser storage.

Any statement in this checklist about clinical behaviour is a statement about *frontend wiring against the
documented contract*, not a statement that a screening was clinically validated or that a review round-tripped
through a live database.
