/**
 * New Entry — patient registration + vitals intake (step 1 of the nurse flow).
 *
 * OWNER: agent 2. Consumes the frozen props in `./contract` and the `.nv-*`
 * vocabulary defined in `./CONTRACT.md` §4 (written by agent 1 in `nurse.css`).
 * This module owns no business logic: every field is a value/onChange pair and
 * `ready` is the orchestrator's existing `intakeReady` predicate.
 *
 * Submission fidelity: the fields rendered here are exactly the fields the
 * orchestrator already submits (fullName, age, sex, village, phone, spo2,
 * respiratoryRate, temperatureC, symptomNotes, existingPatientId). Nothing new
 * is added to the payload, and no field is made newly required.
 *
 * Deviations from the mockup, deliberate:
 *  - "Save draft" is omitted — this app has no draft persistence and patient
 *    data must never be written to localStorage. The sticky footer carries
 *    "Back" + "Continue to audio" instead.
 *  - The mockup's "ID (optional)" field is omitted — there is no patient-ID
 *    input in the schema; the backend mints `patientCode` itself.
 *  - Phone is labelled without an asterisk and marked "optional" (the Convex
 *    validator is `v.optional(v.string())`).
 *
 * Motion: mount-only fade/rise (adapted from the Forge sources named in the
 * report), collapsed by `prefers-reduced-motion`.
 */
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "motion/react";
import {
  Activity,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  House,
  Phone,
  Search,
  Thermometer,
  UserRound,
  Wind,
  WifiOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@convex/api";
import type {
  IntakeMode,
  NewEntryScreenProps,
  PatientId,
  Sex,
} from "./contract";
import { NurseStepRail } from "./NurseStepRail";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Symptom chips are helpers for the free-text `symptomNotes` field only. */
const SYMPTOM_CHIPS = [
  "Cough",
  "Fever",
  "Breathlessness",
  "Fatigue",
  "Poor appetite",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWord(notes: string, word: string): boolean {
  if (!notes.trim()) return false;
  return new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(notes);
}

/**
 * Toggle one symptom word inside the free-text notes without touching the rest
 * of the sentence (regional-language text included).
 */
function toggleWord(notes: string, word: string): string {
  if (hasWord(notes, word)) {
    return notes
      .replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "i"), "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s*([,;\n])\s*/g, "$1 ")
      .replace(/^[\s,;]+/, "")
      .replace(/[\s,;]+$/, "")
      .replace(/\s{2,}/g, " ");
  }
  const base = notes.trim().replace(/[,;]\s*$/, "");
  return base ? `${base}, ${word}` : word;
}

/** True when the notes hold text that no symptom chip accounts for. */
function hasOtherNotes(notes: string): boolean {
  const tokens = notes
    .split(/[,;\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.some(
    (token) =>
      !SYMPTOM_CHIPS.some((word) => word.toLowerCase() === token.toLowerCase()),
  );
}

function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0 : 0.5,
        delay: reduced ? 0 : delay,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
}

export function NewEntryScreen({
  values,
  onChange,
  ready,
  onContinue,
  onCancel,
  connection,
}: NewEntryScreenProps) {
  const reduced = useReducedMotion();
  const [search, setSearch] = useState("");
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [touched, setTouched] = useState<{
    fullName?: boolean;
    age?: boolean;
    village?: boolean;
  }>({});

  const patients = useQuery(
    api.triageLogbook.searchOrListPatients,
    values.intakeMode === "existing" ? { search } : "skip",
  );

  const ageNumber = Number(values.age);
  const ageValid =
    values.age.trim().length > 0 &&
    Number.isInteger(ageNumber) &&
    ageNumber >= 1 &&
    ageNumber <= 120;

  const nameError =
    touched.fullName && values.fullName.trim().length <= 1
      ? "Enter at least two characters for the patient's name."
      : null;
  const ageError = touched.age
    ? values.age.trim().length === 0
      ? "Age is required."
      : !ageValid
        ? "Age must be a whole number from 1 to 120."
        : null
    : null;
  const villageError =
    touched.village &&
    values.intakeMode === "new" &&
    values.village.trim().length === 0
      ? "Village is required."
      : null;

  const otherNotes = useMemo(
    () => hasOtherNotes(values.symptomNotes),
    [values.symptomNotes],
  );

  const footerHint = ready
    ? "Vitals and symptoms are optional — they sharpen the triage read."
    : values.intakeMode === "existing"
      ? "Choose a patient from the roster to continue."
      : "Needed: full name, age (1–120) and village.";

  const switchMode = (mode: IntakeMode) => {
    if (values.intakeMode === mode) return;
    onChange("intakeMode", mode);
    onChange("existingPatientId", null);
  };

  const selectPatient = (patient: {
    _id: PatientId;
    fullName?: string;
    age: number;
    sex: Sex;
    village?: string;
  }) => {
    onChange("existingPatientId", patient._id);
    onChange("fullName", patient.fullName ?? "");
    onChange("age", String(patient.age));
    onChange("sex", patient.sex);
    onChange("village", patient.village ?? "");
  };

  return (
    <div className="nv-page">
      <section className="nv-card" aria-labelledby="nv-new-entry-title">
        <header className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[var(--nv-r-sm)] bg-[var(--nv-sage)] text-[var(--nv-forest)]"
          >
            <ClipboardPlus className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <h1
              id="nv-new-entry-title"
              className="text-[clamp(24px,7vw,29px)] font-bold leading-[1.08] tracking-tight text-[var(--nv-ink)]"
            >
              New Entry
            </h1>
            <p className="mt-1 text-[13.5px] leading-snug text-[var(--nv-ink-2)]">
              Register patient, record vitals, capture audio
            </p>
          </div>
        </header>

        <NurseStepRail current={1} />

        {connection === "offline" && (
          <p className="nv-alert" role="status">
            <WifiOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Offline — keep filling the form. Submission needs a connection, so
              retry when the signal returns.
            </span>
          </p>
        )}

        <div className="grid gap-3">
          <Reveal delay={0}>
            <section className="nv-section" aria-labelledby="nv-patient-title">
              <h2 id="nv-patient-title" className="nv-section__title">
                Patient Information
              </h2>

              <div
                className="nv-seg"
                role="group"
                aria-label="Patient source"
              >
                {(["new", "existing"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={values.intakeMode === mode}
                    className={`nv-seg__opt ${
                      values.intakeMode === mode ? "nv-seg__opt--on" : ""
                    }`}
                    onClick={() => switchMode(mode)}
                  >
                    {mode === "new" ? "New patient" : "Existing"}
                  </button>
                ))}
              </div>

              {values.intakeMode === "new" ? (
                <div className="grid gap-3">
                  <Field
                    id="nv-full-name"
                    label="Patient name"
                    icon={UserRound}
                    value={values.fullName}
                    onChange={(value) => onChange("fullName", value)}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, fullName: true }))
                    }
                    placeholder="Patient name"
                    autoComplete="off"
                    required
                    error={nameError}
                  />

                  <div className="nv-grid-2">
                    <Field
                      id="nv-age"
                      label="Age"
                      icon={CalendarDays}
                      value={values.age}
                      onChange={(value) => onChange("age", value)}
                      onBlur={() =>
                        setTouched((prev) => ({ ...prev, age: true }))
                      }
                      placeholder="Years"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      error={ageError}
                    />

                    <div className="nv-field min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="nv-field__label" id="nv-sex-label">
                          Sex
                        </span>
                        <span className="nv-field__req" aria-hidden>
                          *
                        </span>
                      </div>
                      <div
                        className="nv-seg"
                        role="group"
                        aria-labelledby="nv-sex-label"
                      >
                        {(
                          [
                            ["F", "Female"],
                            ["M", "Male"],
                            ["O", "Other"],
                          ] as const
                        ).map(([sex, longLabel]) => (
                          <button
                            key={sex}
                            type="button"
                            aria-pressed={values.sex === sex}
                            aria-label={longLabel}
                            className={`nv-seg__opt ${
                              values.sex === sex ? "nv-seg__opt--on" : ""
                            }`}
                            onClick={() => onChange("sex", sex)}
                          >
                            {sex}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Field
                    id="nv-village"
                    label="Village"
                    icon={House}
                    value={values.village}
                    onChange={(value) => onChange("village", value)}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, village: true }))
                    }
                    placeholder="Village / hamlet"
                    autoComplete="off"
                    required
                    error={villageError}
                  />

                  <Field
                    id="nv-phone"
                    label="Phone or household contact"
                    icon={Phone}
                    value={values.phone}
                    onChange={(value) => onChange("phone", value)}
                    placeholder="10-digit number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    optional
                    hint="Stored with the patient record for follow-up."
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <div className="nv-field min-w-0">
                    <label htmlFor="nv-patient-search" className="nv-field__label">
                      Search roster
                    </label>
                    <div className="nv-search">
                      <Search
                        aria-hidden
                        className="nv-search__icon h-[18px] w-[18px]"
                      />
                      <input
                        id="nv-patient-search"
                        className="nv-input nv-input--icon scroll-mb-[120px]"
                        type="search"
                        inputMode="search"
                        placeholder="Name, code or phone"
                        value={search}
                        autoComplete="off"
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="nv-rows max-h-[280px] overflow-y-auto">
                    {patients === undefined && (
                      <p className="nv-hint">Loading roster…</p>
                    )}
                    {patients !== undefined &&
                      patients.length === 0 && (
                        <p className="nv-empty">
                          No matching patients in this PHC roster.
                        </p>
                      )}
                    {(patients ?? []).map((patient) => {
                      const selected =
                        values.existingPatientId === patient._id;
                      return (
                        <button
                          key={patient._id}
                          type="button"
                          aria-pressed={selected}
                          className={`nv-row ${selected ? "nv-row--on" : ""}`}
                          onClick={() =>
                            selectPatient({
                              _id: patient._id,
                              fullName: patient.fullName,
                              age: patient.age,
                              sex: patient.sex,
                              village: patient.village,
                            })
                          }
                        >
                          <span className="nv-row__main">
                            <span className="nv-row__title truncate">
                              {patient.fullName ?? "Unnamed patient"}
                            </span>
                            <span className="nv-row__meta truncate">
                              {patient.patientCode ?? "—"} · {patient.age}y{" "}
                              {patient.sex} · {patient.village ?? "—"}
                            </span>
                          </span>
                          {selected ? (
                            <Check
                              aria-hidden
                              className="h-4 w-4 shrink-0 text-[var(--nv-forest)]"
                            />
                          ) : (
                            <ChevronRight
                              aria-hidden
                              className="h-4 w-4 shrink-0 text-[var(--nv-ink-2)]"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {values.existingPatientId !== null && (
                    <p className="nv-notice" role="status">
                      Existing record selected — this screening is added to the
                      saved patient, no new patient is created.
                    </p>
                  )}
                </div>
              )}
            </section>
          </Reveal>

          <div className="nv-divider" aria-hidden />

          <Reveal delay={0.04}>
            <section className="nv-section" aria-labelledby="nv-vitals-title">
              <h2 id="nv-vitals-title" className="nv-section__title">
                Vital signs
                <span className="nv-section__hint">
                  optional · improves accuracy
                </span>
              </h2>

              <div className="nv-grid-3">
                <VitalField
                  id="nv-spo2"
                  label="SpO₂"
                  unit="%"
                  ariaLabel="SpO₂ oxygen saturation, percent"
                  icon={Activity}
                  value={values.spo2}
                  onChange={(value) => onChange("spo2", value)}
                  placeholder="98"
                  inputMode="numeric"
                />
                <VitalField
                  id="nv-rr"
                  label="RR"
                  unit="/min"
                  ariaLabel="Respiratory rate, breaths per minute"
                  icon={Wind}
                  value={values.respiratoryRate}
                  onChange={(value) => onChange("respiratoryRate", value)}
                  placeholder="18"
                  inputMode="numeric"
                />
                <VitalField
                  id="nv-temp"
                  label="Temp"
                  unit="°C"
                  ariaLabel="Temperature, degrees Celsius"
                  icon={Thermometer}
                  value={values.temperatureC}
                  onChange={(value) => onChange("temperatureC", value)}
                  placeholder="36.8"
                  inputMode="decimal"
                />
              </div>
            </section>
          </Reveal>

          <div className="nv-divider" aria-hidden />

          <Reveal delay={0.08}>
            <section className="nv-section" aria-labelledby="nv-symptoms-title">
              <h2 id="nv-symptoms-title" className="nv-section__title">
                Symptoms
                <span className="nv-section__hint">(select all that apply)</span>
              </h2>

              <div className="nv-chips">
                {SYMPTOM_CHIPS.map((word) => {
                  const on = hasWord(values.symptomNotes, word);
                  return (
                    <button
                      key={word}
                      type="button"
                      aria-pressed={on}
                      className={`nv-chip ${on ? "nv-chip--on" : ""}`}
                      onClick={() =>
                        onChange(
                          "symptomNotes",
                          toggleWord(values.symptomNotes, word),
                        )
                      }
                    >
                      {on && <Check aria-hidden className="h-3.5 w-3.5" />}
                      <span>{word}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={otherNotes}
                  aria-describedby="nv-other-hint"
                  className={`nv-chip ${otherNotes ? "nv-chip--on" : ""}`}
                  onClick={() => {
                    notesRef.current?.focus();
                    const length = values.symptomNotes.length;
                    notesRef.current?.setSelectionRange(length, length);
                  }}
                >
                  {otherNotes && <Check aria-hidden className="h-3.5 w-3.5" />}
                  <span>Other</span>
                </button>
              </div>
              <p id="nv-other-hint" className="nv-hint">
                “Other” jumps to Notes — type any extra symptom there.
              </p>
            </section>
          </Reveal>

          <div className="nv-divider" aria-hidden />

          <Reveal delay={0.12}>
            <section className="nv-section" aria-labelledby="nv-notes-title">
              <h2 id="nv-notes-title" className="nv-section__title">
                Notes
              </h2>
              <label htmlFor="nv-notes" className="nv-field__label">
                Symptom notes (Hindi / regional / English)
              </label>
              <textarea
                id="nv-notes"
                ref={notesRef}
                className="nv-textarea scroll-mb-[160px]"
                rows={3}
                value={values.symptomNotes}
                onChange={(event) =>
                  onChange("symptomNotes", event.target.value)
                }
                placeholder="खाँसी, बुखार / cough, fever"
                aria-describedby="nv-notes-hint"
              />
              <p id="nv-notes-hint" className="nv-hint">
                Main concern, onset and treatment go here — chips above only
                add the English word.
              </p>
            </section>
          </Reveal>
        </div>
      </section>

      <footer className="nv-footer">
        <p className="nv-hint" id="nv-entry-status">
          {footerHint}
        </p>
        <div className="nv-btn-row">
          <button
            type="button"
            className="nv-btn nv-btn--quiet min-w-0"
            onClick={onCancel}
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
            Back
          </button>
          <motion.button
            type="button"
            className="nv-btn nv-btn--primary min-w-0"
            disabled={!ready}
            aria-describedby="nv-entry-status"
            onClick={onContinue}
            whileTap={reduced ? undefined : { scale: 0.985 }}
          >
            Continue to audio
          </motion.button>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Field({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  required,
  optional,
  error,
  hint,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  type?: "text" | "tel" | "search";
  inputMode?: "text" | "numeric" | "tel" | "decimal";
  autoComplete?: string;
  required?: boolean;
  optional?: boolean;
  error?: string | null;
  hint?: string;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="nv-field min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <label htmlFor={id} className="nv-field__label">
          {label}
        </label>
        {required && (
          <span className="nv-field__req" aria-hidden>
            *
          </span>
        )}
        {optional && <span className="nv-hint">optional</span>}
      </div>
      <div className="nv-field__wrap">
        <Icon aria-hidden className="nv-field__icon h-[18px] w-[18px]" />
        <input
          id={id}
          className={`nv-input nv-input--icon scroll-mb-[120px] ${
            error ? "nv-invalid" : ""
          }`}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-required={required ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="nv-hint">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="nv-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function VitalField({
  id,
  label,
  unit,
  ariaLabel,
  icon: Icon,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  id: string;
  label: string;
  unit: string;
  ariaLabel: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <div className="nv-field min-w-0">
      <div className="flex items-center gap-1">
        <Icon
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-[var(--nv-ink-2)]"
        />
        <label htmlFor={id} className="nv-field__label truncate">
          {label}
        </label>
        <span
          aria-hidden
          className="shrink-0 text-[10.5px] font-semibold leading-none text-[var(--nv-ink-2)]"
        >
          {unit}
        </span>
      </div>
      <input
        id={id}
        className="nv-input scroll-mb-[120px] text-center"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
