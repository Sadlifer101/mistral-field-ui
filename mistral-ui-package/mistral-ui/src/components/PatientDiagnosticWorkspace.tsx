import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useQuery } from "convex/react";
import { Activity, BarChart3, FileText, History, Pencil, Thermometer, Wind } from "lucide-react";
import { api } from "@convex/api";
import { displayName, formatPacketKB, levelFromScreening, type PatientId, type ScreeningId } from "../lib/clinical";
import { glass, STATUS, type ThemeMode } from "../theme/glass";
import { AcousticSamplePlayer, type AcousticPlayback } from "./AcousticSamplePlayer";
import { FftSpectrumChart } from "./FftSpectrumChart";
import { LongitudinalLogbook } from "./LongitudinalLogbook";
import { SpecialistSignOffPanel } from "./SpecialistSignOffPanel";
import { analyzeClinicalAcoustics, type ClinicalEngineResult, type DifferentialKey } from "../utils/clinicalAcousticEngine";

const TABS = [
  { id: "assessment", title: "Assessment", Icon: Activity },
  { id: "analysis", title: "Analysis", Icon: BarChart3 },
  { id: "summary", title: "Clinical summary", Icon: FileText },
  { id: "history", title: "History & documents", Icon: History },
  { id: "notes", title: "Notes", Icon: Pencil },
] as const;

type Tab = typeof TABS[number]["id"];
const INITIAL_PLAYBACK: AcousticPlayback = { isPlaying: false, hasPlayback: false, progress: 0, channel: "cough" };

function Note({ title, children }: { title: string; children: ReactNode }) {
  return <div className="sp-note"><h3>{title}</h3><p dir="auto">{children}</p></div>;
}

function ModelEstimate({ clinical }: { clinical: ClinicalEngineResult }) {
  const entries = (Object.keys(clinical.probabilities) as DifferentialKey[])
    .sort((a, b) => clinical.probabilities[b] - clinical.probabilities[a]);

  return (
    <section className="sp-model">
      <h2>Acoustic model estimates</h2>
      <p>Decision support for specialist review</p>
      {entries.map((key) => (
        <div key={key} className="sp-estimate">
          <span>{clinical.labels[key]}</span>
          <strong>{clinical.probabilities[key]}%</strong>
          <span className="sp-analytics-track" aria-hidden="true"><span style={{ width: `${clinical.probabilities[key]}%` }} /></span>
        </div>
      ))}
    </section>
  );
}

export function PatientDiagnosticWorkspace({ patientId, screeningId, theme, onOpenScreening, onSignedOff }: {
  patientId: PatientId;
  screeningId: ScreeningId | null;
  theme: ThemeMode;
  onOpenScreening: (screeningId: ScreeningId) => void;
  onSignedOff: (notice: string) => void;
}) {
  const logbook = useQuery(api.triageLogbook.getPatientLogbook, { patientId });
  const patient = logbook?.patient;
  const screening = screeningId
    ? logbook?.screenings.find((row) => row._id === screeningId)
    : logbook?.screenings[0];

  const [tab, setTab] = useState<Tab>("assessment");
  const [playback, setPlayback] = useState<AcousticPlayback>(INITIAL_PLAYBACK);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabIndicatorId = useId();
  const reducedMotion = useReducedMotion();
  const tokens = glass(theme);
  const chart = screening?.frequencyChartData;
  const hasFft = Boolean(chart?.fftBins.length);
  const clinical = useMemo(() => {
    if (!patient || !screening || !hasFft) return null;
    return analyzeClinicalAcoustics({
      frequencyChartData: screening.frequencyChartData ?? null,
      spO2: screening.spo2Percent ?? null,
      respiratoryRate: screening.respiratoryRate ?? null,
      temperatureC: screening.temperatureC ?? null,
      age: patient.age,
      symptomNotes: screening.symptomNotes || screening.rawTranscript || "",
    });
  }, [hasFft, patient, screening]);

  if (logbook === undefined) return <p className="sp-list-empty" role="status">Loading patient record…</p>;
  if (!logbook || !patient) return <p className="sp-list-empty" role="status">The patient record is unavailable.</p>;

  const name = displayName(patient.fullName, patient.patientCode ?? "Patient record");
  const level = screening ? levelFromScreening(screening.level1Status, screening.riskScore) : null;
  const tone = STATUS[level === "urgent" ? "high" : level === "normal" ? "low" : "medium"];
  const heading = (
    <header className="sp-patient-header">
      <div>
        <p className="sp-eyebrow">{[patient.patientCode, patient.village].filter(Boolean).join(" · ") || "Patient record"}</p>
        <h1>{name}</h1>
        <p>{patient.age} yrs · {patient.sex}{screening && Number.isFinite(screening._creationTime) && ` · Screened ${new Date(screening._creationTime).toLocaleDateString("en-GB", { dateStyle: "medium" })}`}</p>
      </div>
      {screening && (
        <div className="sp-patient-status">
          <span className="sp-priority" data-priority={level ?? undefined}>
            <span style={{ background: tone.dot }} />{tone.label} priority
          </span>
          <span>{screening.reviewStatus === "reviewed" ? "Signed off" : screening.reviewStatus === "physical_referral" ? "Physical referral" : "Awaiting review"}</span>
        </div>
      )}
    </header>
  );

  if (!screening) {
    return (
      <section className="sp-workspace">
        <div aria-hidden="true" className="sp-workspace-material" style={{ ...tokens.panel, position: "absolute", borderRadius: "inherit" }} />
        {heading}
        <div className="sp-patient-body">
          <p role="status">{screeningId ? "This screening is unavailable. Other visits and documents are listed below." : "No screenings are on file for this patient."}</p>
          <LongitudinalLogbook logbook={logbook} activeScreeningId={null} theme={theme} onOpenScreening={onOpenScreening} />
        </div>
      </section>
    );
  }

  function moveTab(event: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((entry) => entry.id === tab);
    const next = event.key === "ArrowRight" ? (index + 1) % TABS.length
      : event.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length
      : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setTab(TABS[next].id);
    tabsRef.current?.querySelectorAll("button")[next]?.focus();
  }

  const acousticTab = tab === "assessment" || tab === "analysis";
  const vitals = [
    { label: "SpO₂", value: screening.spo2Percent, unit: "%", Icon: Wind },
    { label: "Resp. rate", value: screening.respiratoryRate, unit: "/min", Icon: Activity },
    { label: "Temperature", value: screening.temperatureC, unit: "°C", Icon: Thermometer },
  ];

  return (
    <section className="sp-workspace" aria-label="Patient workspace">
      <div aria-hidden="true" className="sp-workspace-material" style={{ ...tokens.panel, position: "absolute", borderRadius: "inherit" }} />
      {heading}
      <div ref={tabsRef} role="tablist" aria-label="Patient workspace sections" onKeyDown={moveTab} className="sp-patient-tabs">
        {TABS.map(({ id, title, Icon }) => (
          <button type="button" role="tab" aria-selected={tab === id} aria-controls={`sp-panel-${id}`}
            tabIndex={tab === id ? 0 : -1} key={id} id={`sp-tab-${id}`} onClick={() => setTab(id)}>
            <Icon size={16} aria-hidden="true" />{title}
            {tab === id && (
              // UI Forge's Motion Primitives AnimatedBackground moves a shared layout ID.
              <motion.span aria-hidden="true" className="sp-tab-indicator"
                layoutId={reducedMotion ? undefined : tabIndicatorId}
                transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }} />
            )}
          </button>
        ))}
      </div>

      <div className="sp-patient-grid">
        <div className="sp-patient-body">
          {TABS.map(({ id }) => (
            <div id={`sp-panel-${id}`} role="tabpanel" aria-labelledby={`sp-tab-${id}`} tabIndex={tab === id ? 0 : -1} hidden={tab !== id} key={id} className="sp-tab-content">
              {tab !== id ? null : (
                <>
                  {id === "assessment" && (
                    <>
                      <h2>Respiratory assessment</h2>
                      <p className="sp-assessment-lead" dir="auto">{screening.symptomNotes?.trim() || screening.translatedEnText?.trim() || "No presenting symptoms recorded."}</p>
                      {clinical && <Note title="Acoustic findings">{clinical.brief.acoustic.split(". ")[0]}.</Note>}
                      {clinical?.signalWarning && <p className="sp-signal-warning">{clinical.signalWarning}</p>}
                      {screening.riskScore != null && <Note title="Recorded screening risk score">{screening.riskScore} / 100</Note>}
                    </>
                  )}
                  {id === "analysis" && (
                    <>
                      <h2>Acoustic analysis</h2>
                      {clinical?.signalWarning && <p className="sp-signal-warning">{clinical.signalWarning}</p>}
                      {hasFft ? <FftSpectrumChart frequencyChartData={chart ?? null} level1Status={level} theme={theme}
                        activeChannel={playback.channel} isPlaying={playback.isPlaying} playbackProgress={playback.progress} />
                        : <p className="sp-secondary">No spectrum was stored for this screening.</p>}
                      {clinical && <Note title="Acoustic findings">{clinical.brief.acoustic}</Note>}
                    </>
                  )}
                  {id === "summary" && (
                    <>
                      <h2>Clinical summary</h2>
                      <Note title="Stored AI clinical brief">{screening.aiClinicalBrief?.trim() || "No AI brief stored for this screening."}</Note>
                      {clinical && <Note title="Acoustic interpretation">{clinical.brief.synthesis}</Note>}
                      <Note title="Patient context">{[
                        patient.smokingHistory ? "Smoking history recorded" : patient.smokingHistory === false ? "No smoking history recorded" : null,
                        ...(patient.chronicConditions ?? []),
                      ].filter(Boolean).join(" · ") || "No additional history recorded."}</Note>
                    </>
                  )}
                  {id === "history" && <LongitudinalLogbook logbook={logbook} activeScreeningId={screening._id} onOpenScreening={onOpenScreening} theme={theme} />}
                  {id === "notes" && (
                    <>
                      <h2>Clinical notes</h2>
                      <Note title="Nurse notes">{screening.symptomNotes || "No nurse notes recorded."}</Note>
                      <Note title="Original transcript">{screening.rawTranscript || "No transcript stored."}</Note>
                      {screening.translatedEnText && <Note title="English translation">{screening.translatedEnText}</Note>}
                      <Note title="Specialist remarks">{screening.specialistRemarks || "No specialist remarks recorded."}</Note>
                      {screening.referralInstructions && <Note title="Referral instructions">{screening.referralInstructions}</Note>}
                      {screening.medicationApproved && screening.approvedMedication && <Note title="Approved medication">{screening.approvedMedication}</Note>}
                      {screening.compressedAudioBytes != null && <Note title="Recording packet">{formatPacketKB(screening.compressedAudioBytes)} Opus</Note>}
                    </>
                  )}
                </>
              )}
            </div>
          ))}
          <section className="sp-recordings" hidden={!acousticTab && !playback.hasPlayback} aria-label="Screening recordings">
            <h2>Screening recordings</h2>
            <div className={"sp-recordings-grid" + (tab === "assessment" && hasFft ? " sp-with-chart" : "")}>
              <AcousticSamplePlayer key={screening._id} coughAudioUrl={screening.coughAudioUrl}
                speechAudioUrl={screening.speechAudioUrl} theme={theme} activeChannel={playback.channel}
                onPlaybackSync={setPlayback} />
              {tab === "assessment" && hasFft && (
                <FftSpectrumChart compact frequencyChartData={chart ?? null} level1Status={level} theme={theme}
                  activeChannel={playback.channel} isPlaying={playback.isPlaying} playbackProgress={playback.progress} />
              )}
            </div>
          </section>
        </div>
        <aside className="sp-patient-rail" aria-label="Clinical context and actions">
          <section>
            <h2>Recorded vitals</h2>
            <dl className="sp-vitals">
              {vitals.map(({ label, Icon, value, unit }) => (
                <div key={label}>
                  <dt><Icon size={15} aria-hidden="true" />{label}</dt>
                  <dd>{value ?? "—"}{value != null && <small>{unit}</small>}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="sp-review-actions">
            <h2>Specialist decision</h2>
            <SpecialistSignOffPanel patient={patient} screening={screening} onSignedOff={onSignedOff} theme={theme} />
          </section>
          {clinical ? <ModelEstimate clinical={clinical} /> : <section><h2>Acoustic model estimates</h2><p className="sp-secondary">No stored spectrum for this screening.</p></section>}
        </aside>
      </div>
    </section>
  );
}
