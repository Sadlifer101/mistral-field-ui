import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { partitionQueue, levelFromScreening, type PatientId, type ScreeningId } from "../lib/clinical";
import { glass, type ThemeMode } from "../theme/glass";
import { PatientDiagnosticWorkspace } from "./PatientDiagnosticWorkspace";
import { PatientDirectoryList } from "./PatientDirectoryList";
import { SpecialistAnalytics, SpecialistHomeHub } from "./SpecialistHomeHub";
import { SpecialistShell, type ShellTab } from "./SpecialistShell";
import { TriageQueueColumn, type PriorityFilter } from "./TriageQueueColumn";
import "./specialist.css";

const SECTIONS = {
  triage: "Dashboard",
  patients: "Patients",
  reviews: "Reviews",
  referrals: "Referrals",
  analytics: "Analytics",
} satisfies Record<ShellTab, string>;

type CaseSelection = { patientId: PatientId; screeningId: ScreeningId | null };
type View = { tab: ShellTab; selection?: CaseSelection; returnTarget?: string };
const HOME: View = { tab: "triage" };
const HISTORY_KEY = "mistralSpecialist";

function previousView(state: unknown): View {
  const view = (state as Record<string, View> | null)?.[HISTORY_KEY];
  return view && Object.hasOwn(SECTIONS, view.tab) ? view : HOME;
}

export class SpecialistErrorBoundary extends Component<{ children: ReactNode; onReturn?: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="sp-list-empty" role="alert">
        <h2 className="font-serif text-2xl">Clinical records could not be loaded</h2>
        <p>Check your connection and try again.</p>
        <div className="flex flex-wrap gap-4 mt-4">
          <button type="button" className="sp-text-action" onClick={() => this.setState({ failed: false })}>Try again</button>
          {this.props.onReturn && <button type="button" className="sp-text-action" onClick={this.props.onReturn}>Return to list</button>}
        </div>
      </section>
    );
  }
}

export function SpecialistConsole({ theme, doctorName, district, onToggleTheme, onSignOut }: {
  theme: ThemeMode;
  doctorName: string;
  district: string;
  onToggleTheme: () => void;
  onSignOut: () => void;
}) {
  const [view, setView] = useState(HOME);
  const [searches, setSearches] = useState<Partial<Record<ShellTab, string>>>({});
  const [filters, setFilters] = useState<Partial<Record<ShellTab, PriorityFilter>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const nextFocus = useRef<string | null>(null);
  const viewed = useRef(view);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const next = previousView(event.state);
      const old = viewed.current;
      nextFocus.current = old.returnTarget && old.tab === next.tab && !next.selection
        ? old.returnTarget
        : "heading";
      viewed.current = next;
      setView(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const target = nextFocus.current;
    if (!target) return;
    nextFocus.current = null;
    if (target === "search") {
      mainRef.current?.querySelector<HTMLInputElement>("[data-specialist-search]")?.focus();
      return;
    }
    const row = target === "heading" ? null : document.getElementById(target);
    if (row) {
      row.focus();
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    mainRef.current?.querySelector<HTMLElement>("[data-view-heading]")?.focus({ preventScroll: true });
  }, [view]);

  function navigate(next: View, focus = "heading", replace = false) {
    nextFocus.current = focus;
    window.history[replace ? "replaceState" : "pushState"]({ ...window.history.state, [HISTORY_KEY]: next }, "");
    viewed.current = next;
    setView(next);
  }

  const { tab, selection } = view;
  const key = selection ? selection.screeningId ?? selection.patientId : tab;

  function selectSection(nextTab: ShellTab) {
    if (tab === nextTab && !selection) return;
    setNotice(null);
    navigate({ tab: nextTab });
  }

  function returnToList() {
    if (view.returnTarget) window.history.back();
    else navigate({ tab }, "heading", true);
  }

  function openPatient(patientId: PatientId, screeningId: ScreeningId | null = null) {
    setNotice(null);
    navigate({ tab, selection: { patientId, screeningId }, returnTarget: `sp-case-${screeningId ?? patientId}` });
  }

  function searchSection() {
    if (!selection && tab !== "analytics") {
      mainRef.current?.querySelector<HTMLInputElement>("[data-specialist-search]")?.focus();
      return;
    }
    navigate({ tab: tab === "analytics" ? "triage" : tab }, "search");
  }

  return (
    <SpecialistShell
      theme={theme} activeTab={tab} onTabChange={selectSection}
      onToggleTheme={onToggleTheme} onSignOut={onSignOut}
      onLogoClick={() => selectSection("triage")} onSearch={searchSection} doctorName={doctorName}
    >
      <main ref={mainRef} className="sp-main">
        {notice && <div role="status" className="sp-notice" style={glass(theme).surface}><CheckCircle2 size={18} aria-hidden="true" />{notice}</div>}
        <div key={key} className="sp-view">
          {selection ? (
            <>
              <div className="sp-back-row">
                <button data-view-heading type="button" className="sp-text-action" onClick={returnToList}>
                  <ArrowLeft size={17} aria-hidden="true" /> Back to {SECTIONS[tab].toLowerCase()}
                </button>
              </div>
              <SpecialistErrorBoundary onReturn={returnToList}>
                <PatientDiagnosticWorkspace
                  patientId={selection.patientId} screeningId={selection.screeningId} theme={theme}
                  onOpenScreening={(screeningId) => navigate({ ...view, selection: { ...selection, screeningId } }, "heading", true)}
                  onSignedOff={(message) => { setNotice(message); returnToList(); }}
                />
              </SpecialistErrorBoundary>
            </>
          ) : (
            <SpecialistErrorBoundary>
              <SpecialistSection
                tab={tab} theme={theme} district={district}
                searchQuery={searches[tab] ?? ""} onSearchChange={(value) => setSearches((old) => ({ ...old, [tab]: value }))}
                priority={filters[tab] ?? "all"} onPriorityChange={(value) => setFilters((old) => ({ ...old, [tab]: value }))}
                onNavigate={selectSection} onSelectCase={openPatient}
              />
            </SpecialistErrorBoundary>
          )}
        </div>
      </main>
    </SpecialistShell>
  );
}

function SpecialistSection({ tab, theme, district, searchQuery, onSearchChange, priority, onPriorityChange, onNavigate, onSelectCase }: {
  tab: ShellTab;
  theme: ThemeMode;
  district: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  priority: PriorityFilter;
  onPriorityChange: (filter: PriorityFilter) => void;
  onNavigate: (tab: ShellTab) => void;
  onSelectCase: (patientId: PatientId, screeningId?: ScreeningId) => void;
}) {
  const queue = useQuery(api.triageLogbook.getSpecialistTriageQueue, tab === "patients" ? "skip" : {});
  const buckets = useMemo(() => {
    if (queue === undefined) return undefined;
    const result = partitionQueue(queue);
    const order = { urgent: 0, monitor: 1, normal: 2 };
    const priority = ({ screening }: (typeof queue)[number]) =>
      order[levelFromScreening(screening.level1Status, screening.riskScore)];
    result.pending.sort((a, b) => priority(a) - priority(b) || (b.screening.riskScore ?? -1) - (a.screening.riskScore ?? -1));
    return result;
  }, [queue]);

  if (tab === "patients") return <PatientDirectoryList theme={theme} searchQuery={searchQuery} onSearchChange={onSearchChange} onSelectPatient={onSelectCase} />;
  if (tab === "analytics") return <SpecialistAnalytics buckets={buckets} theme={theme} onNavigate={onNavigate} />;

  const title = tab === "triage" ? "Triage queue" : tab === "reviews" ? "Completed reviews" : "Physical referrals";
  const description = tab === "triage" ? "No screenings are awaiting review." : tab === "reviews" ? "No completed reviews in the current register." : "No physical referrals in the current register.";
  const list = (
    <TriageQueueColumn
      title={title} emptyLabel={description} theme={theme}
      items={tab === "triage" ? buckets?.pending : tab === "reviews" ? buckets?.reviewed : buckets?.referrals}
      searchQuery={searchQuery} onSearchChange={onSearchChange} priority={priority} onPriorityChange={onPriorityChange} onSelectCase={onSelectCase}
    />
  );

  if (tab === "triage") {
    return <SpecialistHomeHub buckets={buckets} theme={theme} district={district} onNavigate={onNavigate} onSelectCase={onSelectCase}>{list}</SpecialistHomeHub>;
  }
  return (
    <>
      <header className="sp-page-title">
        <h1 data-view-heading tabIndex={-1}>{SECTIONS[tab]}</h1>
        <p>{tab === "reviews" ? "Open signed-off screenings to revisit the clinical decision." : "Open escalated screenings to review referral instructions."}</p>
      </header>
      {list}
    </>
  );
}
