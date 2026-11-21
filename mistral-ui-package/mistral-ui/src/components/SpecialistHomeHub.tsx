import { ArrowRight, ArrowUpRight, ClipboardCheck, CornerUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { displayName, type TriageQueueItem, type PatientId, type ScreeningId } from "../lib/clinical";
import { glass, type ThemeMode } from "../theme/glass";
import type { ShellTab } from "./SpecialistShell";
import type { ReactNode } from "react";

export type ScreeningBuckets = {
  pending: TriageQueueItem[];
  reviewed: TriageQueueItem[];
  referrals: TriageQueueItem[];
};

// Adapted from UI Forge packages/motion/editorial-stagger/index.tsx.
// Keep the brief stagger for dashboard sections, with the same settled path for reduced motion.
const group = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const item = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const } },
};

export function SpecialistHomeHub({ buckets, district, theme, onNavigate, onSelectCase, children }: {
  buckets: ScreeningBuckets | undefined;
  district: string;
  theme: ThemeMode;
  onNavigate: (tab: ShellTab) => void;
  onSelectCase: (patientId: PatientId, screeningId: ScreeningId) => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const links = [
    { key: "reviews", title: "Completed reviews", action: "View reviews", Icon: ClipboardCheck, cases: buckets?.reviewed, empty: "No completed reviews in the current register." },
    { key: "referrals", title: "Referrals & escalations", action: "View referrals", Icon: CornerUpRight, cases: buckets?.referrals, empty: "No physical referrals in the current register." },
  ] as const;

  return (
    <>
      <header className="sp-page-title sp-home-title">
        <div>
          <p className="sp-eyebrow">{district || "Specialist console"}</p>
          <h1 tabIndex={-1} data-view-heading>Specialist dashboard</h1>
          <p>Review screenings submitted by frontline clinics.</p>
        </div>
        <p className="sp-today">{date}</p>
      </header>
      <motion.div className="sp-dashboard-grid" variants={group} initial={reduceMotion ? false : "hidden"} animate="visible">
        <motion.div className="min-w-0" variants={item}>{children}</motion.div>
        <div className="sp-home-side">
          {links.map(({ key, title, action, Icon, cases, empty }) => (
            <motion.section key={key} variants={item} className="sp-activity" style={glass(theme).panel}>
              <div className="sp-activity-top">
                <Icon size={20} aria-hidden="true" />
                <span className="sp-count">{cases?.length ?? "—"}</span>
              </div>
              <h2>{title}</h2>
              {cases === undefined ? <p role="status">Loading screenings…</p> : cases.length === 0 ? <p>{empty}</p> : (
                <ul className="sp-activity-cases">
                  {[...cases].sort((a, b) => b.screening._creationTime - a.screening._creationTime).slice(0, 2).map(({ patient, screening }) => (
                    <li key={screening._id}>
                      <button type="button" id={`sp-case-${screening._id}`} onClick={() => onSelectCase(patient._id, screening._id)}>
                        <span>{displayName(patient.fullName, patient.patientCode ?? "Patient record")}</span>
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="sp-text-action" onClick={() => onNavigate(key)}>
                {action}<ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </motion.section>
          ))}
        </div>
      </motion.div>
    </>
  );
}

export function SpecialistAnalytics({ buckets, theme, onNavigate }: {
  buckets: ScreeningBuckets | undefined;
  theme: ThemeMode;
  onNavigate: (tab: ShellTab) => void;
}) {
  const rows = [
    { tab: "triage", label: "Awaiting review", count: buckets?.pending.length },
    { tab: "reviews", label: "Completed reviews", count: buckets?.reviewed.length },
    { tab: "referrals", label: "Physical referrals", count: buckets?.referrals.length },
  ] as const;
  const total = rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
  return (
    <>
      <header className="sp-page-title">
        <h1 tabIndex={-1} data-view-heading>Analytics</h1>
        <p>Workload across the latest screenings returned by the register{buckets ? ` · ${total} screenings` : ""}</p>
      </header>
      <section className="sp-analytics" style={glass(theme).panel} aria-label="Screenings by review status">
        <h2>Screenings by review status</h2>
        {buckets === undefined ? <p role="status">Loading screening activity…</p> : rows.map(({ tab, label, count = 0 }) => (
          <button type="button" className="sp-analytics-row" key={tab} onClick={() => onNavigate(tab)}>
            <span>{label}</span>
            <span className="sp-analytics-track" aria-hidden="true"><span style={{ width: total ? `${100 * count / total}%` : 0 }} /></span>
            <strong>{count}</strong>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        ))}
      </section>
    </>
  );
}
