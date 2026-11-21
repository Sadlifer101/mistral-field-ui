/**
 * Screening report — post-submit result (step 3).
 *
 * OWNER: agent 2. This is the existing `Instant Clinical Triage Report` block
 * from `MobileNurseApp` re-skinned: every clinical string it rendered is still
 * rendered here, from the same `ClinicalEngineResult`:
 *
 *   report.signalWarning
 *   report.probabilities / report.labels       (differential bars)
 *   report.brief.acoustic + report.brief.vitals (the brief sentence)
 *   report.protocol.title / report.protocol.lines + "AWAITING CITY DOCTOR APPROVAL"
 *   attachNotice + the X-ray / lab file input  → onAttach(file)
 *   "New patient screening"                   → onFinish()
 *
 * No probability, status or claim is added or recomputed here — the engine is
 * the only source. The screen sits on the caller's meadow backdrop and paints
 * no background of its own.
 */
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Camera, ClipboardPlus, ShieldAlert } from "lucide-react";
import type { ScreeningReportScreenProps } from "./contract";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

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

export function ScreeningReportScreen({
  report,
  patientLabel,
  attachNotice,
  onAttach,
  onFinish,
}: ScreeningReportScreenProps) {
  const reduced = useReducedMotion();
  const keys = Object.keys(report.probabilities) as Array<
    keyof typeof report.probabilities
  >;

  return (
    <div className="nv-page">
      <section className="nv-card" aria-labelledby="nv-report-title">
        <header className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[var(--nv-r-sm)] bg-[var(--nv-sage)] text-[var(--nv-forest)]"
          >
            <ClipboardPlus className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <h1
              id="nv-report-title"
              className="text-[clamp(22px,6.4vw,27px)] font-bold leading-[1.1] tracking-tight text-[var(--nv-ink)]"
            >
              Screening report
            </h1>
            <p className="mt-1 break-words text-[13.5px] leading-snug text-[var(--nv-ink-2)]">
              {patientLabel}
            </p>
          </div>
        </header>

        <div className="grid gap-3">
          {report.signalWarning && (
            <Reveal delay={0}>
              <p role="alert" className="nv-alert">
                <ShieldAlert
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>{report.signalWarning}</span>
              </p>
            </Reveal>
          )}

          <Reveal delay={0.05}>
            <section className="nv-section" aria-labelledby="nv-prob-title">
              <h2 id="nv-prob-title" className="nv-section__title">
                Top differential probabilities
              </h2>
              <div className="grid gap-3">
                {keys.map((key) => (
                  <div key={key} className="nv-prob">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-semibold leading-snug text-[var(--nv-ink)]">
                        {report.labels[key]}
                      </span>
                      <span className="shrink-0 font-mono text-[13px] font-bold tabular-nums text-[var(--nv-forest)]">
                        {report.probabilities[key]}%
                      </span>
                    </div>
                    <div className="nv-prob__bar" aria-hidden>
                      <div
                        className="nv-prob__fill"
                        style={{ width: `${report.probabilities[key]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="rounded-[var(--nv-r)] border border-[var(--nv-line)] bg-[var(--nv-sage)] px-3 py-3 text-[13.5px] leading-relaxed text-[var(--nv-ink)]">
              {report.brief.acoustic} {report.brief.vitals}
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <section
              className="rounded-[var(--nv-r)] border border-[var(--nv-line)] bg-[var(--nv-paper-2)] px-3 py-3"
              aria-labelledby="nv-protocol-title"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="nv-protocol-title"
                  className="nv-section__title min-w-0"
                >
                  {report.protocol.title}
                </h2>
                <span className="nv-badge nv-badge--pending shrink-0">
                  AWAITING CITY DOCTOR APPROVAL
                </span>
              </div>
              <div className="mt-2 grid gap-1.5">
                {report.protocol.lines.map((line, index) => (
                  <p
                    key={`${index}-${line}`}
                    className="text-[13px] leading-relaxed text-[var(--nv-ink-2)]"
                  >
                    {line}
                  </p>
                ))}
              </div>
            </section>
          </Reveal>

          {attachNotice && (
            <p role="status" className="nv-notice">
              {attachNotice}
            </p>
          )}

          <Reveal delay={0.2}>
            <label className="nv-btn nv-btn--ghost w-full">
              <Camera aria-hidden className="h-4 w-4" />
              <span>Attach X-ray / lab photo</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="nv-sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onAttach(file);
                  event.target.value = "";
                }}
              />
            </label>
          </Reveal>
        </div>
      </section>

      <footer className="nv-footer">
        <motion.button
          type="button"
          className="nv-btn nv-btn--primary w-full"
          onClick={onFinish}
          whileTap={reduced ? undefined : { scale: 0.985 }}
        >
          <ClipboardPlus aria-hidden className="h-4 w-4" />
          New patient screening
        </motion.button>
      </footer>
    </div>
  );
}
