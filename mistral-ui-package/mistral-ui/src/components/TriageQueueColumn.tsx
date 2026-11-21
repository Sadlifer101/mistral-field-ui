import { ArrowUpRight, ListFilter, Search, X } from "lucide-react";
import { type ReactNode } from "react";
import { displayName, levelFromScreening, type PatientId, type ScreeningId, type TriageQueueItem } from "../lib/clinical";
import { STATUS, glass, type ThemeMode } from "../theme/glass";

import { SpecialistSelect, type SpecialistOption } from "./SpecialistSelect";

export type PriorityFilter = "all" | "urgent" | "monitor" | "normal";

const PRIORITIES: readonly SpecialistOption<PriorityFilter>[] = [
  { value: "all", label: "All priorities" },
  { value: "urgent", label: "High priority", tone: STATUS.high.dot },
  { value: "monitor", label: "Medium priority", tone: STATUS.medium.dot },
  { value: "normal", label: "Low priority", tone: STATUS.low.dot },
];

export function SpecialistSearch({ label, value, onChange, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="sp-list-tools">
      <div className="sp-search">
        <Search size={17} aria-hidden="true" />
        <input type="search" data-specialist-search aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search by name or code" onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }} />
        {value && (
          <button type="button" className="sp-search-clear" aria-label="Clear search" onClick={(event) => {
            event.currentTarget.parentElement?.querySelector("input")?.focus();
            onChange("");
          }}>
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function TriageQueueColumn({ items, onSelectCase, searchQuery, onSearchChange, theme, title, emptyLabel, priority, onPriorityChange }: {
  items: TriageQueueItem[] | undefined;
  onSelectCase: (patientId: PatientId, screeningId: ScreeningId) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  theme: ThemeMode;
  title: string;
  emptyLabel: string;
  priority: PriorityFilter;
  onPriorityChange: (priority: PriorityFilter) => void;
}) {
  const query = searchQuery.trim().toLocaleLowerCase();
  const visible = items?.filter(({ patient, screening }) =>
    (!query || [patient.fullName, patient.patientCode, patient.village].some((field) => field?.toLocaleLowerCase().includes(query))) &&
    (priority === "all" || levelFromScreening(screening.level1Status, screening.riskScore) === priority),
  );
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="sp-list" style={glass(theme).panel} aria-label={title}>
      <div className="sp-list-top">
        <div>
          <h2>{title}</h2>
          <p aria-live="polite">{visible && items ? `${visible.length === items.length ? items.length : `${visible.length} of ${items.length}`} ${items.length === 1 ? "screening" : "screenings"}` : "Loading screenings…"}</p>
        </div>
        <SpecialistSearch label={`Search ${title.toLowerCase()}`} value={searchQuery} onChange={onSearchChange}>
          <SpecialistSelect label="Filter by priority" value={priority} options={PRIORITIES}
            onChange={onPriorityChange} theme={theme} Icon={ListFilter} />
        </SpecialistSearch>
      </div>
      {visible && visible.length > 0 ? (
        <>
          <div className="sp-case-row sp-case-labels" aria-hidden="true"><span>Patient</span><span>Screening notes</span><span>Priority</span><span></span></div>
          <ul>
            {visible.map(({ patient, screening }) => {
              const level = levelFromScreening(screening.level1Status, screening.riskScore);
              const tone = STATUS[level === "urgent" ? "high" : level === "normal" ? "low" : "medium"];
              const complaint = screening.symptomNotes?.trim() || screening.translatedEnText?.trim() || screening.rawTranscript?.trim();
              return (
                <li key={screening._id}>
                  <button type="button" id={`sp-case-${screening._id}`} className="sp-case-row sp-row-button" onClick={() => onSelectCase(patient._id, screening._id)}>
                    <span className="sp-case-identity">
                      <strong>{displayName(patient.fullName, patient.patientCode ?? "Unnamed patient")}</strong>
                      <small>{[patient.patientCode, patient.village].filter(Boolean).join(" · ") || `${patient.age} yrs · ${patient.sex}`}</small>
                    </span>
                    <span className="sp-case-complaint">
                      <span dir="auto">{complaint || "No screening notes"}</span>
                      {Number.isFinite(screening._creationTime) && <small>{date.format(screening._creationTime)}</small>}
                    </span>
                    <span className="sp-priority" data-priority={level}><span style={{ background: tone.dot }} />{tone.label}</span>
                    <ArrowUpRight size={18} className="sp-row-arrow" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : visible ? <p className="sp-list-empty">{query || priority !== "all" ? "No screenings match these filters." : emptyLabel}</p> : <p className="sp-list-empty" role="status">Retrieving the screening register…</p>}
    </section>
  );
}
