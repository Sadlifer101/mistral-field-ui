/**
 * Subject: doctor feedback for one patient screening (reference image 4,
 * bottom half). OWNER: Agent 3.
 *
 * Every string below is either
 *   - a value read from the real screening document returned by
 *     `api.triageLogbook.getSpecialistTriageQueue` / `searchOrListPatients`, or
 *   - an explicit absence message ("Pending specialist review", "No specialist
 *     sign-off has been recorded…"), or
 *   - an on-device derivation from the stored fields
 *     (`analyzeClinicalAcoustics`, `locateNearestFacility`).
 * The mockup's sample remark ("Findings consistent with hypertension…") is
 * never used because no such value exists in the schema.
 */
import { Component, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/api";
import {
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Clock3,
  ExternalLink,
  Hospital,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  Pill,
  Stethoscope,
} from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@convex/dataModel";
import {
  displayName,
  formatPacketKB,
  levelFromScreening,
  type Level1Status,
  type TriageQueueItem,
} from "../lib/clinical";
import { analyzeClinicalAcoustics } from "../utils/clinicalAcousticEngine";
import { locateNearestFacility } from "../utils/nearestFacilityLocator";
import {
  derivePatientStatus,
  formatAge,
  formatEntryDate,
  sexLabel,
  type PatientStatus,
  type PatientStatusTone,
} from "./patientStatus";

const INK_2 = "var(--nv-ink-2)";
const LINE = "var(--nv-line)";
const PAPER_2 = "var(--nv-paper-2)";

type QueueScreening = TriageQueueItem["screening"];
type QueuePatient = TriageQueueItem["patient"];

export interface PatientFeedbackPanelProps {
  patient: QueuePatient;
  /** `null` when the patient has no screening in the loaded queue. */
  screening: QueueScreening | null;
  onBack: () => void;
}

/* ------------------------------------------------------------------ atoms */

function StatusGlyph({ tone }: { tone: PatientStatusTone }) {
  const className = "h-[13px] w-[13px] shrink-0";
  if (tone === "reviewed") return <CircleCheck className={className} aria-hidden="true" />;
  if (tone === "referral") return <Hospital className={className} aria-hidden="true" />;
  if (tone === "pending") return <Clock3 className={className} aria-hidden="true" />;
  return <ClipboardList className={className} aria-hidden="true" />;
}

/** Shared by the list rows and every feedback card. */
export function StatusBadge({
  status,
  className = "",
}: {
  status: PatientStatus;
  className?: string;
}) {
  return (
    <span className={`${status.badgeClass} inline-flex items-center gap-1 ${className}`}>
      <StatusGlyph tone={status.tone} />
      <span>{status.label}</span>
    </span>
  );
}

/**
 * `useQuery` re-throws query errors during render, so each query-owning child
 * sits inside this boundary instead of letting the error escape to App.tsx.
 * The message names the surface, and retry is a real remount attempt.
 */
export class QueryErrorBoundary extends Component<
  { children: ReactNode; label: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="nv-alert flex flex-col gap-2">
          <p className="flex items-start gap-2 text-sm font-semibold">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Could not load {this.props.label} from the sync server.</span>
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="nv-btn nv-btn--quiet nv-btn--sm inline-flex min-h-11 w-fit items-center justify-center"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------- the panel */

export function PatientFeedbackPanel({ patient, screening, onBack }: PatientFeedbackPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const status = derivePatientStatus(screening);

  const reviewerName = screening?.reviewedByName?.trim() ?? "";
  const reviewerFacility = screening?.reviewedByFacility?.trim() ?? "";
  const reviewerDistrict = screening?.reviewedByDistrict?.trim() ?? "";
  const reviewerPhone = screening?.reviewedByPhone?.trim() ?? "";
  const hasReviewer = Boolean(
    reviewerName || reviewerFacility || reviewerDistrict || reviewerPhone,
  );

  const remark = screening?.specialistRemarks?.trim() ?? "";
  const provisional = screening?.provisionalMedication?.trim() ?? "";
  const approved = screening?.approvedMedication?.trim() ?? "";
  const medicationApproved = screening?.medicationApproved === true;
  const medicationText = !screening
    ? ""
    : medicationApproved
      ? approved || provisional
      : provisional;
  const referralRequired =
    screening != null &&
    (screening.physicalReferralFlag === true || screening.reviewStatus === "physical_referral");
  const referralText = !screening
    ? ""
    : referralRequired
      ? screening.referralInstructions?.trim() || "Referral required"
      : "Not required.";

  const clinical = useMemo(
    () =>
      screening
        ? analyzeClinicalAcoustics({
            frequencyChartData: screening.frequencyChartData ?? null,
            spO2: screening.spo2Percent ?? null,
            respiratoryRate: screening.respiratoryRate ?? null,
            temperatureC: screening.temperatureC ?? null,
            age: patient.age,
            symptomNotes: screening.symptomNotes || screening.rawTranscript || "",
          })
        : null,
    [patient.age, screening],
  );

  const nearest = useMemo(
    () =>
      locateNearestFacility({
        village: patient.village,
        district: screening?.reviewedByDistrict,
      }),
    [patient.village, screening?.reviewedByDistrict],
  );

  const packet = screening ? formatPacketKB(screening.compressedAudioBytes) : "";
  const packetText = packet && packet !== "—" ? ` · ${packet} acoustic packet` : "";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="nv-btn nv-btn--quiet nv-btn--sm"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to list
        </button>
      </div>

      {/* Patient identity — kept visible so the feedback is never context-free. */}
      <section className="nv-card" aria-labelledby="nv-feedback-patient">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="nv-feedback-patient"
              className="text-[clamp(20px,5.6vw,24px)] font-bold leading-tight"
            >
              {displayName(patient.fullName, "Unnamed patient")}
            </h2>
            <p className="mt-1 text-[13px] leading-snug" style={{ color: INK_2 }}>
              {patient.patientCode?.trim() || "No patient code"} ·{" "}
              {patient.village?.trim() || "No village recorded"}
            </p>
            <p className="text-[13px] leading-snug" style={{ color: INK_2 }}>
              {sexLabel(patient.sex)} · {formatAge(patient.age)}
            </p>
          </div>
          <StatusBadge status={status} className="shrink-0" />
        </div>
        <p className="mt-3 text-[12px] leading-snug" style={{ color: INK_2 }}>
          {screening
            ? `Screening ${formatEntryDate(screening._creationTime)}${packetText}`
            : "No screening is stored for this patient yet."}
        </p>
      </section>

      {/* The reference card: stethoscope + title + status pill, then key/values. */}
      <section className="nv-feedback" aria-labelledby="nv-feedback-title">
        <div className="nv-feedback__head">
          <span
            aria-hidden="true"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "var(--nv-sage)", color: "var(--nv-forest)" }}
          >
            <Stethoscope className="h-6 w-6" />
          </span>
          <h2 id="nv-feedback-title" className="nv-feedback__title">
            Doctor Feedback
          </h2>
          <span className={`nv-feedback__status ${status.badgeClass}`}>
            <StatusGlyph tone={status.tone} />
            <span>{status.label}</span>
          </span>
        </div>

        <dl className="m-0 flex flex-col">
          <div className="nv-kv">
            <dt className="nv-kv__k m-0">
              <MessageSquareText className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Specialist remark</span>
            </dt>
            <dd className="nv-kv__v m-0">
              <span className="block">
                {remark || (screening ? "Pending specialist review" : "No screening yet.")}
              </span>
              {screening && !remark ? (
                <span className="nv-hint mt-1 block">
                  No specialist remark has been written on this screening yet.
                </span>
              ) : null}
            </dd>
          </div>

          <div className="nv-kv">
            <dt className="nv-kv__k m-0">
              <Pill className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Approved treatment</span>
            </dt>
            <dd className="nv-kv__v m-0">
              <span className="block">
                {screening
                  ? medicationText || "No medication text is recorded on this screening."
                  : "No screening yet — nothing has been prescribed."}
              </span>
              {screening ? (
                <span className="nv-hint mt-1 block">
                  {medicationApproved
                    ? "Approved by the reviewing specialist."
                    : "Provisional — awaiting specialist sign-off."}
                </span>
              ) : null}
            </dd>
          </div>

          <div className="nv-kv">
            <dt className="nv-kv__k m-0">
              <Hospital className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Referral</span>
            </dt>
            <dd className="nv-kv__v m-0">
              <span className="block">{screening ? referralText : "No screening yet."}</span>
              {screening && referralRequired ? (
                <span className="nv-hint mt-1 block">
                  Physical referral flagged by the specialist review.
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      {/* Real reviewer/routing fields — only rendered when the backend stored them. */}
      <section className="nv-card nv-card--soft" aria-labelledby="nv-feedback-routing">
        <h3 id="nv-feedback-routing" className="nv-section__title">
          Reviewing doctor &amp; hospital routing
        </h3>
        {hasReviewer ? (
          <dl className="m-0 mt-2 flex flex-col">
            {reviewerName ? (
              <div className="nv-kv">
                <dt className="nv-kv__k m-0">Doctor</dt>
                <dd className="nv-kv__v m-0">{reviewerName}</dd>
              </div>
            ) : null}
            {reviewerFacility ? (
              <div className="nv-kv">
                <dt className="nv-kv__k m-0">Hospital</dt>
                <dd className="nv-kv__v m-0">{reviewerFacility}</dd>
              </div>
            ) : null}
            {reviewerDistrict ? (
              <div className="nv-kv">
                <dt className="nv-kv__k m-0">District</dt>
                <dd className="nv-kv__v m-0">{reviewerDistrict}</dd>
              </div>
            ) : null}
            {reviewerPhone ? (
              <div className="nv-kv">
                <dt className="nv-kv__k m-0">Phone</dt>
                <dd className="nv-kv__v m-0">
                  <a
                    href={`tel:${reviewerPhone}`}
                    className="inline-flex min-h-11 items-center gap-1.5 font-semibold underline"
                    style={{ color: "var(--nv-info-ink)" }}
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {reviewerPhone}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="nv-hint mt-2">
            No specialist sign-off has been recorded for this screening yet.
          </p>
        )}
      </section>

      {/* On-device differential from the stored FFT bins + vitals (real derivation). */}
      {clinical ? (
        <section className="nv-card nv-card--soft" aria-labelledby="nv-feedback-differential">
          <h3 id="nv-feedback-differential" className="nv-section__title">
            Differential probability
          </h3>
          <p className="nv-section__hint">
            Computed on-device from the stored acoustic features and vitals. Not a specialist
            diagnosis.
          </p>
          {clinical.signalWarning ? (
            <p className="nv-notice mt-2">{clinical.signalWarning}</p>
          ) : null}
          <div className="mt-3 flex flex-col gap-3">
            {(Object.keys(clinical.probabilities) as Array<keyof typeof clinical.probabilities>).map(
              (key) => (
                <div key={key} className="nv-prob">
                  <div className="flex items-baseline justify-between gap-2 text-[13px] font-semibold">
                    <span>{clinical.labels[key]}</span>
                    <span className="tabular-nums">{clinical.probabilities[key]}%</span>
                  </div>
                  <div className="nv-prob__bar" aria-hidden="true">
                    <div
                      className="nv-prob__fill"
                      style={{ width: `${clinical.probabilities[key]}%` }}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      {/* Existing nearestFacilityLocator — a distance estimate, not a decision. */}
      <section className="nv-card nv-card--soft" aria-labelledby="nv-feedback-nearest">
        <h3 id="nv-feedback-nearest" className="nv-section__title">
          Nearest referral facility
        </h3>
        <p className="nv-section__hint">
          Distance estimate from the recorded village — not a referral decision.
        </p>
        <p className="mt-2 text-[15px] font-semibold leading-snug">{nearest.hospitalName}</p>
        <p className="text-[13px] leading-snug" style={{ color: INK_2 }}>
          {nearest.specialistName}
        </p>
        <p
          className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug"
          style={{ color: INK_2 }}
        >
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {nearest.distanceKm} km · {nearest.address}
          </span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={`tel:${nearest.phone}`}
            className="nv-btn nv-btn--ghost nv-btn--sm inline-flex min-h-11 items-center gap-1.5"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {nearest.phone}
          </a>
          <a
            href={nearest.directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="nv-btn nv-btn--ghost nv-btn--sm inline-flex min-h-11 items-center gap-1.5"
          >
            <Navigation className="h-4 w-4" aria-hidden="true" />
            Directions
          </a>
        </div>
      </section>

      {/* Reference's final action. History is a real query, only when opened. */}
      <section className="nv-card nv-card--soft" aria-labelledby="nv-feedback-history">
        <h3 id="nv-feedback-history" className="nv-section__title">
          Patient history
        </h3>
        <p className="nv-section__hint">
          Loads this patient&apos;s full screening history from the logbook.
        </p>
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
          aria-controls="nv-patient-history"
          className="nv-btn nv-btn--primary mt-3 inline-flex min-h-13 w-full items-center justify-center gap-2"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {historyOpen ? "Hide patient history" : "Open patient"}
        </button>
        <div id="nv-patient-history">
          {historyOpen ? (
            <QueryErrorBoundary label="patient screening history">
              <ScreeningHistory patientId={patient._id} />
            </QueryErrorBoundary>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------- screening history */

const LEVEL_LABEL: Record<Level1Status, string> = {
  normal: "Normal",
  monitor: "Monitor",
  urgent: "Urgent",
};

const LEVEL_COLOR: Record<Level1Status, string> = {
  normal: "var(--nv-ok)",
  monitor: "var(--nv-warn-ink)",
  urgent: "var(--nv-danger)",
};

function describeAudio(screening: {
  coughAudioUrl?: string | null;
  speechAudioUrl?: string | null;
}): string {
  const cough = Boolean(screening.coughAudioUrl);
  const speech = Boolean(screening.speechAudioUrl);
  if (cough && speech) return "cough + phonation audio";
  if (cough) return "cough audio only";
  if (speech) return "phonation audio only";
  return "no audio file stored";
}

function ScreeningHistory({ patientId }: { patientId: Id<"patients"> }) {
  const logbook: FunctionReturnType<typeof api.triageLogbook.getPatientLogbook> | undefined =
    useQuery(api.triageLogbook.getPatientLogbook, { patientId });

  if (logbook === undefined) {
    return (
      <div>
        <p className="nv-hint mt-3" role="status" aria-live="polite">
          Loading screening history…
        </p>
      </div>
    );
  }

  const { screenings, documents } = logbook;

  return (
    <div>
      {screenings.length === 0 ? (
        <p className="nv-empty mt-3" aria-live="polite">
          No screening has been submitted for this patient yet.
        </p>
      ) : (
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {screenings.map((entry) => {
            const entryStatus = derivePatientStatus(entry);
            const level = levelFromScreening(entry.level1Status, entry.riskScore);
            return (
              <li
                key={entry._id}
                className="rounded-[var(--nv-r-sm)] border p-3"
                style={{ borderColor: LINE, background: PAPER_2 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-snug">
                      {formatEntryDate(entry._creationTime)}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug" style={{ color: INK_2 }}>
                      <span className="font-semibold" style={{ color: LEVEL_COLOR[level] }}>
                        {LEVEL_LABEL[level]}
                      </span>{" "}
                      · {describeAudio(entry)} · {formatPacketKB(entry.compressedAudioBytes)}
                    </p>
                  </div>
                  <StatusBadge status={entryStatus} className="shrink-0" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {documents.length > 0 ? (
        <p className="nv-hint mt-2">
          {documents.length} document{documents.length === 1 ? "" : "s"} on file for this patient.
        </p>
      ) : null}
    </div>
  );
}
