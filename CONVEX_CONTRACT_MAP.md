# Convex Contract Map

Every backend function the redesigned frontend calls, with the exact argument validators, the fields it reads
from each return value, and the file/line of every call site. Verified against `convex/triageLogbook.ts`,
`convex/auth.ts` and `convex/schema.ts` of the Mistral backend this UI was built against.

**Your backend stays authoritative.** This document is a map of the frontend's dependencies, not a request to
change anything. Nothing here redefines schema, authorization or clinical processing.

---

## 1. How the client reaches these functions

```ts
import { api } from "@convex/api";        // 13 files
import type { Id } from "@convex/dataModel";
```

| Layer | Configuration | File |
| --- | --- | --- |
| TypeScript paths | `"@convex/*": ["../../convex/_generated/*"]` | `mistral-ui-package/mistral-ui/tsconfig.json` |
| Vite alias | `{ find: "@convex", replacement: path.resolve(__dirname, "../../convex/_generated") }` | `mistral-ui-package/mistral-ui/vite.config.ts` |
| Generated refs shipped with this repo | `convex/_generated/{api.js,api.d.ts,dataModel.d.ts,server.js,server.d.ts}` | repo root |

The alias is mandatory in the Vite setup. In a Next integration, TypeScript `paths` is enough for types, but
the import must also resolve at bundle time — match what your app already does
(`ConvexClientProvider.tsx` imports `../../convex/_generated/api` directly).

### When the bundled `_generated` can be reused

| Situation | Action |
| --- | --- |
| Your `convex/` **matches** the tree this UI was built against (same modules, same exported functions, same validators) | The bundled `convex/_generated` compiles unchanged. |
| `convex/` has **any** difference — renamed function, changed argument key, added/removed module | Run `npx convex dev` (or `npx convex codegen`) in the repo that owns `convex/`, then point the alias at the regenerated folder. **Never hand-edit `_generated`.** |
| You only changed runtime behaviour inside a handler (validation, queries, ordering) but not its signature | Either works; regenerating is still the safer habit. |

`api.js` is a runtime reference factory (`anyApi` from `convex/server`) — it contains no backend logic.
`api.d.ts` and `dataModel.d.ts` are type-only and `import type` your backend modules, so they require a
sibling `convex/` tree to type-check.

---

## 2. Authentication (`convex/auth.ts`)

| Reference | Kind | Arguments | Returns | Where it is used |
| --- | --- | --- | --- | --- |
| `api.auth.refreshSession` | action | — | session | `src/main.tsx:14` — `ConvexAuthProvider` `api` prop |
| `api.auth.signOut` | action | — | — | `src/main.tsx:15` — provider, and both surfaces' sign-out |
| `api.auth.isAuthenticated` | query | — | `boolean` | `src/main.tsx:16` — provider |

Google sign-in uses the custom method exported by `setupGoogle` in your `auth.ts`:

```tsx
const { signIn } = useSignInWithGoogle(api.auth);   // src/components/WelcomeAuthPage.tsx:28
void signIn();                                       // starts the OAuth redirect
```

Backend prerequisites (yours to own):

- `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET` on the deployment.
- `allowedRedirectOrigins` in `setupGoogle(...)` — currently `[env.CONVEX_SITE_URL, "http://localhost:3000"]`.
  **Any other origin fails** with `redirectTo origin "…" is not in allowedRedirectOrigins`. This is the single
  most common integration blocker when the UI runs on another port, on `127.0.0.1`, or on a LAN IP.
- `attachUserCallbacks({ createUser: internal.users.createUserGoogle })`.

The UI never calls a password provider; the email/password fields on the sign-in card are an explicit stub.

---

## 3. `convex/triageLogbook.ts` — the ten functions the UI uses

Line numbers refer to the backend source as shipped in this project's reference tree.

| # | Function | Kind | Arguments (exact validators) | Returns |
| --- | --- | --- | --- | --- |
| 1 | `getMyStaffProfile` | query | `{ role?: "nurse" \| "primary_doctor" \| "city_specialist" }` | `staffProfiles \| null` |
| 2 | `upsertStaffProfile` | mutation | `{ role, fullName: string, facilityName: string, district: string, hprRegistrationId?: string, phoneNumber?: string }` | `Id<"staffProfiles">` |
| 3 | `searchOrListPatients` | query | `{ search?: string }` | `patients[]` |
| 4 | `createLogbookPatient` | mutation | `{ fullName: string, age: number, sex: "M"\|"F"\|"O", village: string, preferredLang: Lang, smokingHistory: boolean, phone?: string, chronicConditions?: string[] }` | `Id<"patients">` |
| 5 | `generateAudioUploadUrl` | mutation | `{}` | `string` (Convex storage upload URL) |
| 6 | `submitTriageScreening` | mutation | see §3.1 | `Id<"screenings">` |
| 7 | `getPatientLogbook` | query | `{ patientId: Id<"patients"> }` | `{ patient, screenings[], documents[] }` |
| 8 | `attachPatientDocument` | mutation | `{ patientId, screeningId?: Id<"screenings">, fileId: Id<"_storage">, fileName: string, docType: DocType, notes?: string }` | `Id<"patientDocuments">` |
| 9 | `getSpecialistTriageQueue` | query | `{ statusFilter?: "pending_review"\|"reviewed"\|"physical_referral" }` | `Array<{ screening, patient }>` |
| 10 | `submitSpecialistReview` | mutation | see §3.2 | `null` |

### 3.1 `submitTriageScreening` argument object (as the UI sends it)

| Key | Validator | Sent by the UI | Source |
| --- | --- | --- | --- |
| `patientId` | `Id<"patients">` | yes | created or selected patient |
| `coughAudioId` | `Id<"_storage">` | yes | cough upload |
| `speechAudioId` | `Id<"_storage">` | yes | phonation upload |
| `rawAudioBytes` | `number?` | yes ( = compressed total) | `MobileNurseApp.tsx` |
| `compressedAudioBytes` | `number?` | yes | cough + phonation byte totals |
| `compressionRatio` | `number?` | no | — |
| `frequencyChartData` | `{ fftBins: number[], fundamentalFreqHz, spectralCentroidHz, zeroCrossingRate, peakRmsEnergy }` | yes | merged from both captures |
| `symptomNotes` | `string?` | when non-empty | notes field / chips |
| `spo2Percent` | `number?` | when filled | vitals |
| `respiratoryRate` | `number?` | when filled | vitals |
| `temperatureC` | `number?` | when filled | vitals |
| `provisionalMedication` | `string?` | yes | local protocol lines joined |
| `aiClinicalBrief` | `string?` | yes | local heuristic synthesis |
| `rawTranscript` | `string?` | yes (same text as notes) | notes field |
| `translatedEnText` | `string?` | yes | local heuristic translation |
| `level1Status` | `"normal"\|"monitor"\|"urgent"?` | yes | local engine |
| `predictedConditions` | `Array<{ label: string, confidence: number }>?` | yes | local engine, confidence 0–1 |

The mutation itself sets `status: "uploaded"` and `reviewStatus: "pending_review"`, schedules
`internal.aiPipeline.processScreening`, and returns the new screening id. **The client never writes `status`,
`riskScore` or pipeline outputs** — those belong to the backend.

### 3.2 `submitSpecialistReview` argument object (as the UI sends it)

| Key | Validator | Notes |
| --- | --- | --- |
| `screeningId` | `Id<"screenings">` | required |
| `specialistRemarks` | `string` | required (trimmed) |
| `physicalReferralFlag` | `boolean` | required; drives the review status |
| `referralInstructions` | `string?` | when non-empty |
| `approvedMedication` | `string?` | when medication approved |
| `medicationApproved` | `boolean?` | toggle state |
| `reviewedByName` | `string?` | UI sends the signed-in specialist's `fullName` |

`reviewedByPhone`, `reviewedByFacility`, `reviewedByDistrict` and `provisionalMedication` are accepted by the
backend but not sent by this UI (the backend falls back to the specialist's staff profile). The backend writes
`reviewStatus: physicalReferralFlag ? "physical_referral" : "reviewed"` and stamps `reviewedBySpecialistId`.

### 3.3 Fields the UI reads from each return value

| Return | Fields consumed | Consumed by |
| --- | --- | --- |
| `staffProfiles` | `fullName`, `facilityName`, `district`, `phoneNumber`, `role` | `App.tsx`, `NurseShell`, `SpecialistSignOffPanel` |
| `patients[]` | `_id`, `fullName`, `patientCode`, `age`, `sex`, `village`, `preferredLang`, `phone?`, `chronicConditions?`, `_creationTime` | `PatientDirectoryList`, `NewEntryScreen`, `PatientsReviewsScreen` |
| `{ patient, screenings, documents }` | screenings: `_id`, `status`, `reviewStatus`, `riskScore?`, `level1Status?`, `specialistRemarks?`, `approvedMedication?`, `medicationApproved?`, `referralInstructions?`, `physicalReferralFlag?`, `reviewedBy*`, `frequencyChartData`, `coughAudioUrl`, `speechAudioUrl`, `predictedConditions?`, `_creationTime`; documents: `fileUrl`, `fileName`, `docType`, `uploadedAt` | `PatientDiagnosticWorkspace`, `PatientFeedbackPanel`, `LongitudinalLogbook` |
| queue rows | screening + patient as above, ordered by the backend (referral first, then `riskScore` desc) | `SpecialistConsole`, `PatientsReviewsScreen`, `TriageQueueColumn` |

---

## 4. Literal vocabularies (from `convex/schema.ts`)

| Validator | Values |
| --- | --- |
| `sexValidator` | `"M"`, `"F"`, `"O"` |
| `preferredLangValidator` | `"hi"`, `"en"`, `"ta"`, `"te"`, `"bn"`, `"mr"`, `"kn"` |
| `staffRoleValidator` | `"nurse"`, `"primary_doctor"`, `"city_specialist"` |
| `screeningStatusValidator` | `"recording"`, `"uploaded"`, `"processing"`, `"completed"`, `"failed"` |
| `reviewStatusValidator` | `"pending_review"`, `"reviewed"`, `"physical_referral"` |
| `level1StatusValidator` | `"normal"`, `"monitor"`, `"urgent"` |
| `patientDocTypeValidator` | `"xray"`, `"lab_report"`, `"primary_rx"`, `"other"` |
| `frequencyChartDataValidator` | `{ fftBins: number[], fundamentalFreqHz, spectralCentroidHz, zeroCrossingRate, peakRmsEnergy }` |
| `predictedConditionValidator` | `{ label: string, confidence: number }` |

The UI's `detectPreferredLang()` emits a subset of the language set from the script it detects in the notes
field; the document `docType` is guessed as `xray` for images/chest names and `lab_report` otherwise.

---

## 5. The two state machines — preserved, not duplicated

### Screening processing status (`screenings.status`)

```
recording → uploaded → processing → completed
                            ↘ failed
```

- Written by: the backend only. `submitTriageScreening` inserts `uploaded`; `internal.aiPipeline.processScreening`
  (scheduled by that mutation) advances the rest.
- Read by: the UI (`screening.status`, plus `riskScore` / `level1Status` / `predictedConditions`) to render
  badges, risk bars and the differential.

### Specialist review status (`screenings.reviewStatus`)

```
pending_review ──(submitSpecialistReview, physicalReferralFlag=false)──► reviewed
      │
      └────────(submitSpecialistReview, physicalReferralFlag=true)────► physical_referral
```

- Written by: `submitSpecialistReview` only.
- Read by: the specialist queue partition (`pending` / `previous` / `referrals`), and the nurse-side badge
  derivation in `src/nurse/patientStatus.ts`:

  | Data | Nurse badge |
  | --- | --- |
  | no screening | "No screening yet" |
  | `reviewStatus === "reviewed"` | "Reviewed" |
  | `reviewStatus === "physical_referral"` **or** `physicalReferralFlag === true` | "Referral" |
  | otherwise | "Awaiting review" |

Do not add parallel status fields, duplicate tables, or a second review workflow; the nurse surface depends on
these exact fields.

---

## 6. Audio storage flow

```
capture (5 s, Opus/WebM, MediaRecorder)
   → generateAudioUploadUrl({})            [mutation, returns storage URL]
   → POST <url>  (blob, Content-Type)      [Convex storage, no auth header needed]
   → { storageId }                          [Id<"_storage">]
   → submitTriageScreening({ coughAudioId, speechAudioId, … })
   → backend stores ids in coughAudioId/speechAudioId (and legacy *StorageId aliases)
   → getPatientLogbook / getSpecialistTriageQueue resolve them via ctx.storage.getUrl()
   → UI plays back through AcousticSamplePlayer / HTMLAudioElement
```

Document uploads reuse the same upload-URL mutation, then `attachPatientDocument` with the returned
`storageId` as `fileId`. Playback URLs are always resolved server-side — the UI never guesses a storage path.

---

## 7. Review feedback loop

```
nurse submits screening ──► reviewStatus: pending_review
specialist opens queue row (getSpecialistTriageQueue)
   → loads getPatientLogbook({ patientId }) for history, audio, documents
   → submitSpecialistReview({ specialistRemarks, physicalReferralFlag, … })
        reviewStatus: reviewed | physical_referral
nurse reopens Patients & Reviews
   → searchOrListPatients + getSpecialistTriageQueue (status badges)
   → getPatientLogbook({ patientId }) → PatientFeedbackPanel
        specialistRemarks · approvedMedication · referralInstructions · reviewedBy*
```

There is no nurse-only notification channel and no extra table: the nurse reads the same screening fields the
specialist wrote.

---

## 8. What the integration must not change

| Area | Owner | Rule |
| --- | --- | --- |
| `convex/schema.ts` | backend | Do not modify tables, indexes or validators to fit the UI. |
| `convex/auth.ts`, `auth.config.ts` | backend | Keep Google OAuth and existing user identities. Only `allowedRedirectOrigins` may need your origin added — with your approval. |
| `convex/triageLogbook.ts` and other functions | backend | Keep names, argument keys and return shapes; adjust the UI call sites instead. |
| `convex/aiPipeline.ts`, `screeningInternal.ts` | backend | Clinical processing stays server-side; the UI never calls it. |
| Deployments / env | backend | No deployment changes from the frontend work. |
| Duplicated backend trees | backend | `convex/` exists in more than one checkout; keep one authoritative copy and regenerate `_generated` from it. |

If a function genuinely differs from this map, change the **frontend** reference (and its argument object) —
all call sites are listed in §3 above. There is no adapter layer in this repo, by design.
