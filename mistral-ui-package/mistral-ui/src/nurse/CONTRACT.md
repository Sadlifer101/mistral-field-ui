# Mistral Field nurse UI — parallel build contract

Read this before writing a single line. `src/nurse/contract.ts` (owned by the lead)
is frozen: implement against it, never edit it.

## 1. Non-negotiable boundaries

- Frontend only: `mistral-full/mistral-ui-package/mistral-ui`.
- **Never** touch `mistral-backend/`, `mistral-full/convex/`, `src/main.tsx`,
  `src/App.tsx`, `src/index.css`, `src/theme/glass.ts`, `src/components/specialist.css`,
  `src/components/FluidBackdrop.tsx`, or any `Specialist*` component.
- **Never** edit a file you do not own (§2), including `src/nurse/contract.ts`,
  `src/nurse/CONTRACT.md`, `src/components/MobileNurseApp.tsx`.
- No new npm dependencies. No webfonts. No CSS frameworks beyond Tailwind v4 utilities.
- No subagents, no web access, no repo-wide scans, no production builds.
- Do not invent backend fields, statuses or review outcomes. Only what
  `api.triageLogbook.*` already returns.
- Do not simulate uploads, sync, or success states.

## 2. File ownership (disjoint — do not cross)

| Owner | Files (create/edit only these) |
|---|---|
| **Lead** | `src/nurse/contract.ts`, `src/nurse/CONTRACT.md`, `src/components/MobileNurseApp.tsx`, `public/media/*` |
| **Agent 1** | `src/nurse/nurse.css`, `src/nurse/MeadowBackdrop.tsx`, `src/nurse/NurseShell.tsx`, `src/nurse/NurseHomeScreen.tsx`, `src/nurse/NurseStepRail.tsx` |
| **Agent 2** | `src/nurse/NewEntryScreen.tsx`, `src/nurse/AudioCaptureScreen.tsx`, `src/nurse/ScreeningReportScreen.tsx` |
| **Agent 3** | `src/nurse/PatientsReviewsScreen.tsx`, `src/nurse/PatientFeedbackPanel.tsx`, `src/nurse/patientStatus.ts` |
| **Agent 4** | none (review only) |

Exactly one agent owns each new file. Need something another agent owns? **Do not
create a second copy** — use the class names in §4 and the props in §3.

## 3. Frozen exports

Every screen module exports a **named** function component with exactly these names
and prop types from `./contract`:

```
MeadowBackdrop.tsx           -> export function MeadowBackdrop(props: MeadowBackdropProps)
NurseShell.tsx               -> export function NurseShell(props: NurseShellProps)
NurseHomeScreen.tsx          -> export function NurseHomeScreen(props: NurseHomeScreenProps)
NurseStepRail.tsx            -> export function NurseStepRail(props: NurseStepRailProps)
NewEntryScreen.tsx           -> export function NewEntryScreen(props: NewEntryScreenProps)
AudioCaptureScreen.tsx       -> export function AudioCaptureScreen(props: AudioCaptureScreenProps)
ScreeningReportScreen.tsx    -> export function ScreeningReportScreen(props: ScreeningReportScreenProps)
PatientsReviewsScreen.tsx    -> export function PatientsReviewsScreen(props: PatientsReviewsScreenProps)
```

`nurse.css` is imported once, inside `NurseShell.tsx` (`import "./nurse.css";`).
It must style the `.nv-*` vocabulary below **scoped under `.nv-app`** so nothing
leaks into the specialist console or auth pages.

## 4. CSS vocabulary — Agent 1 implements ALL of these, Agent 2/3 consume them

Tokens on `.nv-app` (custom properties, `--nv-` prefix):
`--nv-paper #FAF6EA  --nv-paper-2 #F3EDDC  --nv-ink #26301B  --nv-ink-2 #5B6650
--nv-line rgba(46,58,32,.14)  --nv-sage #E7E4CE  --nv-sage-2 #DCE0C4
--nv-forest #33471F  --nv-forest-ink #F6F3E6  --nv-olive #566B3E
--nv-ok #3E5C28  --nv-warn-bg #F6E3B4  --nv-warn-ink #7A5210
--nv-info-bg #D8E9F3  --nv-info-ink #1F5F7A  --nv-danger #B3402F
--nv-r-sm 10px  --nv-r 16px  --nv-r-lg 24px  --nv-shadow 0 10px 30px -18px rgba(38,54,22,.55)
--nv-ease cubic-bezier(.16,1,.3,1)`

Classes (all under `.nv-app`):

**Shell / layout** `nv-app`, `nv-shell`, `nv-header`, `nv-brand`, `nv-brand-mark`,
`nv-brand-word`, `nv-header-actions`, `nv-sync`, `nv-sync--live|--connecting|--offline`,
`nv-main`, `nv-main--flush`, `nv-backdrop`, `nv-backdrop__video`, `nv-backdrop__veil`.

**Home** `nv-home`, `nv-home-intro`, `nv-home-card`, `nv-home-card__icon`,
`nv-home-card__body`, `nv-home-card__title`, `nv-home-card__desc`, `nv-home-card__rule`.

**Step rail** `nv-steps`, `nv-step`, `nv-step--current`, `nv-step--done`, `nv-step__dot`,
`nv-step__label`, `nv-step__line`, `nv-step__line--done`.

**Surface** `nv-page`, `nv-card`, `nv-card--soft`, `nv-section`, `nv-section__title`,
`nv-section__hint`, `nv-divider`, `nv-empty`, `nv-alert`, `nv-notice`, `nv-sr-only`.

**Fields** `nv-field`, `nv-field__label`, `nv-field__req`, `nv-field__wrap`, `nv-field__icon`,
`nv-input`, `nv-input--icon`, `nv-textarea`, `nv-select`, `nv-hint`, `nv-grid-2`, `nv-grid-3`,
`nv-invalid`.

**Chips / segmented** `nv-chips`, `nv-chip`, `nv-chip--on`, `nv-seg`, `nv-seg__opt`,
`nv-seg__opt--on`.

**Buttons** `nv-btn`, `nv-btn--primary`, `nv-btn--ghost`, `nv-btn--quiet`, `nv-btn--danger-tint`,
`nv-btn-row`, `nv-btn--sm`.

**Capture** `nv-capture`, `nv-capture__head`, `nv-capture__title`, `nv-capture__hint`,
`nv-wave`, `nv-wave__bar`, `nv-rec`, `nv-rec--live`, `nv-rec__timer`, `nv-capture__actions`,
`nv-duration`.

**Tabs / list / badges** `nv-tabs`, `nv-tabs__list`, `nv-tab`, `nv-tab--on`, `nv-tab__count`,
`nv-rows`, `nv-row`, `nv-row--on`, `nv-row__main`, `nv-row__title`, `nv-row__meta`,
`nv-row__right`, `nv-badge`, `nv-badge--pending`, `nv-badge--reviewed`, `nv-badge--referral`,
`nv-badge--neutral`, `nv-search`, `nv-search__icon`.

**Feedback / key-value** `nv-feedback`, `nv-feedback__head`, `nv-feedback__title`,
`nv-feedback__status`, `nv-kv`, `nv-kv__k`, `nv-kv__v`, `nv-prob`, `nv-prob__bar`,
`nv-prob__fill`.

**Footer CTA** `nv-footer` (sticky, safe-area aware, `nv-footer--split`).

Agent 2 and 3 may use additional Tailwind utilities for layout, but **must not**
restyle these classes or add global selectors.

## 5. Visual specification (from the four reference images)

Warm watercolor meadow behind, cream paper cards, olive/forest green actions.

- Page background: `MeadowBackdrop` (poster always, video only on home).
- Cards: `--nv-paper`, 1px `--nv-line` border, `--nv-r-lg` radius, `--nv-shadow`, padding 18–20px.
- Headings: `--font-sans`, 700, tight leading; page title 26–30px, section title 17–18px.
- Body: 14–15px / 1.55, `--nv-ink-2` for supporting copy.
- Primary button: `--nv-forest` bg, `--nv-forest-ink` text, 52–56px tall, radius 14px,
  full width inside cards, `nv-btn-row` for side-by-side (secondary `nv-btn--ghost`).
- Inputs: 52px tall, `--nv-paper-2` fill, 1px `--nv-line`, radius 12px, 16px text
  (16px avoids iOS zoom), leading icon in `--nv-ink-2`.
- Chips: `--nv-sage` pill, selected = `--nv-sage-2` + forest dot/check.
- Badges: pill, 11–12px, 700, uppercase-free (sentence case), per status.
- Touch targets ≥ 44px; never below 44px for anything interactive.
- Max content width 480px centred; on ≥768px the card stays ≤ 520px and the meadow
  fills the viewport.

## 6. Data contracts (do not extend)

- Roster/search: `api.triageLogbook.searchOrListPatients({ search? })` → patients.
- Queue + review status: `api.triageLogbook.getSpecialistTriageQueue({})` → `QueueRow[]`
  (`row.patient`, `row.screening`).
- Patient detail: `api.triageLogbook.getPatientLogbook({ patientId })` → `{ patient, screenings, documents }`.
- Status truth order: `reviewStatus` (`pending_review|reviewed|physical_referral`) →
  then `physicalReferralFlag` / `medicationApproved` flags. No other statuses exist.
- A patient with no screening is **not** "draft" — say "No screening yet".
- Audio: `CaptureResult` from `src/utils/edgeAudioRecorder.ts`; recorder must keep its
  current **5-second auto-stop** protocol, Opus/mime negotiation and FFT analysis.
  Reference mockups show 0:12/0:15 — those are illustrative, do not copy them.

## 7. Motion, responsiveness, a11y

- `motion/react` only, no new libs; 1 animation owner per property.
- Respect `prefers-reduced-motion`: every transform/opacity transition must collapse.
- No continuous animation except the home backdrop video and the live mic waveform.
- Keyboard: visible focus ring, real `<button>`/`<label>` semantics, `aria-live` for
  recording/submission state, `role="alert"` for errors.
- Mobile widths 320/360/375/390/414/430 must not overflow horizontally; no fixed
  pixel widths; use `min-h-dvh`, `env(safe-area-inset-*)`, `text-[clamp()]` if needed.
- Sticky footers must sit above `env(safe-area-inset-bottom)` and never cover inputs.

## 8. Definition of done

- Type-checks: `npx tsc --noEmit` may be run **at most once**, at the end.
- Report back: files written, class/export list, any reference deviation, and anything
  you could not verify.
