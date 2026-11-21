/**
 * Patients & Reviews — nurse surface, reference image 4.
 * OWNER: Agent 3. Styling comes from `src/nurse/nurse.css` (`.nv-*` vocabulary,
 * owned by Agent 1); this module only composes classes + Tailwind layout
 * utilities. It never imports a CSS file.
 *
 * Real data only:
 *   api.triageLogbook.searchOrListPatients({ search })  -> Patients tab rows
 *   api.triageLogbook.getSpecialistTriageQueue({})      -> Doctor Reviews rows,
 *       the tab/section counts, and each patient's latest screening (status)
 *   api.triageLogbook.getPatientLogbook({ patientId })  -> screening history,
 *       loaded only inside PatientFeedbackPanel when "Open patient" is used.
 */
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { motion, useReducedMotion } from "motion/react";
import {
  ChevronLeft,
  FolderOpen,
  Search,
  Stethoscope,
  UsersRound,
  X,
} from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { displayName, partitionQueue, type TriageQueueItem } from "../lib/clinical";
import type { PatientsReviewsScreenProps } from "./contract";
import {
  PatientFeedbackPanel,
  QueryErrorBoundary,
  StatusBadge,
} from "./PatientFeedbackPanel";
import {
  derivePatientStatus,
  formatAge,
  formatEntryDate,
  sexLabel,
} from "./patientStatus";

const INK_2 = "var(--nv-ink-2)";
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type PatientRow = FunctionReturnType<typeof api.triageLogbook.searchOrListPatients>[number];
type ScreenTab = "patients" | "reviews";
type ReviewFilter = "all" | "pending" | "reviewed" | "referrals";

type Selection =
  | { kind: "queue"; row: TriageQueueItem }
  | {
      kind: "patient";
      patient: PatientRow;
      screening: TriageQueueItem["screening"] | null;
    };

const TABS: Array<{
  id: ScreenTab;
  label: string;
  Icon: typeof UsersRound;
}> = [
  { id: "patients", label: "Patients", Icon: UsersRound },
  { id: "reviews", label: "Doctor Reviews", Icon: Stethoscope },
];

const FILTERS: Array<{ id: ReviewFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "reviewed", label: "Reviewed" },
  { id: "referrals", label: "Referrals" },
];

/**
 * The screen's own error boundary has to sit above the component that calls
 * `useQuery`: Convex re-throws query failures during render, and the app shell
 * must not lose the whole nurse surface because one query failed.
 */
export function PatientsReviewsScreen(props: PatientsReviewsScreenProps) {
  return (
    <QueryErrorBoundary label="patients and doctor reviews">
      <PatientsReviewsBody {...props} />
    </QueryErrorBoundary>
  );
}

function PatientsReviewsBody({ onBack, onStartScreening }: PatientsReviewsScreenProps) {
  const [tab, setTab] = useState<ScreenTab>("patients");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [selection, setSelection] = useState<Selection | null>(null);
  const deferredSearch = useDeferredValue(search);
  const reducedMotion = useReducedMotion();
  const searchId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);

  /* Selecting a patient must not look inert. The feedback card is appended below
     the still-visible list (reference image 4), so bring it into view and move
     focus into it — instant, never a smooth scroll that delays a clinical read. */
  useEffect(() => {
    if (!selection) return;
    const node = panelRef.current;
    if (!node) return;
    node.scrollIntoView({ block: "start" });
    node.focus({ preventScroll: true });
  }, [selection]);

  // Patients tab: the real roster query. Kept subscribed while the detail is
  // open so going "Back to list" re-renders instantly with the same search.
  const patients = useQuery(
    api.triageLogbook.searchOrListPatients,
    tab === "patients" ? { search: deferredSearch.trim() } : "skip",
  );
  // Queue backs the Doctor Reviews tab, its counts, and each patient's latest
  // screening. It is intentionally fetched for both tabs.
  const queue = useQuery(api.triageLogbook.getSpecialistTriageQueue, {});

  const groups = useMemo(() => partitionQueue(queue ?? []), [queue]);
  const totalQueue = queue?.length;
  const busy = tab === "patients" ? patients === undefined || queue === undefined : queue === undefined;

  const latestByPatient = useMemo(() => {
    const map = new Map<string, TriageQueueItem["screening"]>();
    for (const row of queue ?? []) {
      const current = map.get(row.patient._id);
      if (!current || row.screening._creationTime > current._creationTime) {
        map.set(row.patient._id, row.screening);
      }
    }
    return map;
  }, [queue]);

  const selectTab = (next: ScreenTab) => {
    setTab(next);
    setSelection(null);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") {
      return;
    }
    event.preventDefault();
    const currentIndex = TABS.findIndex((entry) => entry.id === tab);
    let nextIndex = currentIndex;
    if (key === "ArrowLeft") nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    if (key === "ArrowRight") nextIndex = (currentIndex + 1) % TABS.length;
    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = TABS.length - 1;
    selectTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const selectPatient = (patient: PatientRow) => {
    setSelection({
      kind: "patient",
      patient,
      screening: latestByPatient.get(patient._id) ?? null,
    });
  };

  const selectedPatientName = selection
    ? displayName(
        selection.kind === "queue" ? selection.row.patient.fullName : selection.patient.fullName,
        "Unnamed patient",
      )
    : "";

  const announcement = selection
    ? `Doctor feedback for ${selectedPatientName}`
    : tab === "patients"
      ? patients === undefined || queue === undefined
        ? "Loading saved patients"
        : `${patients.length} ${patients.length === 1 ? "patient" : "patients"} listed`
      : queue === undefined
        ? "Loading doctor reviews"
        : `${totalQueue ?? 0} ${(totalQueue ?? 0) === 1 ? "review" : "reviews"} in the queue`;

  const visibleReviews: TriageQueueItem[] =
    filter === "all"
      ? (queue ?? [])
      : filter === "pending"
        ? groups.pending
        : filter === "reviewed"
          ? groups.reviewed
          : groups.referrals;

  const filterCounts: Record<ReviewFilter, number> = {
    all: totalQueue ?? 0,
    pending: groups.pending.length,
    reviewed: groups.reviewed.length,
    referrals: groups.referrals.length,
  };

  return (
    <>
      <p className="nv-sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="nv-page flex flex-col gap-4">
        <section className="nv-card">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px]"
              style={{ background: "var(--nv-sage)", color: "var(--nv-forest)" }}
            >
              <FolderOpen className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[clamp(24px,7vw,30px)] font-bold leading-tight tracking-tight">
                Patients &amp; Reviews
              </h1>
              <p className="mt-1 text-[14px] leading-snug" style={{ color: INK_2 }}>
                Open saved entries and check doctor feedback
              </p>
            </div>
          </div>

          <div className="nv-tabs">
            <div
              role="tablist"
              aria-label="Patients and doctor reviews"
              aria-orientation="horizontal"
              className="nv-tabs__list flex w-full items-stretch gap-1"
              onKeyDown={onTabKeyDown}
            >
              {TABS.map(({ id, label, Icon }, index) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    ref={(node) => {
                      tabRefs.current[index] = node;
                    }}
                    type="button"
                    role="tab"
                    id={`nv-tab-${id}`}
                    aria-selected={active}
                    aria-controls={`nv-tabpanel-${id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => selectTab(id)}
                    className="nv-tab relative inline-flex min-h-12 items-center justify-center"
                    style={{ position: "relative" }}
                  >
                    {active ? (
                      <motion.span
                        layoutId="nv-tab-pill"
                        aria-hidden="true"
                        transition={{ duration: reducedMotion ? 0 : 0.28, ease: EASE }}
                        className="nv-tab--on"
                        style={{
                          position: "absolute",
                          inset: 0,
                          zIndex: 0,
                          minHeight: 0,
                          borderRadius: "inherit",
                        }}
                      />
                    ) : null}
                    <span
                      className="relative z-[1] inline-flex min-w-0 items-center gap-2"
                      style={active ? { color: "var(--nv-forest-ink)" } : undefined}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      <span className="nv-tab__label">{label}</span>
                      {id === "reviews" && totalQueue !== undefined ? (
                        <span
                          className="nv-tab__count"
                          style={
                            active
                              ? {
                                  color: "var(--nv-forest-ink)",
                                  background:
                                    "color-mix(in srgb, var(--nv-forest-ink) 24%, transparent)",
                                }
                              : undefined
                          }
                        >
                          {totalQueue}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {tab === "patients" && !selection ? (
            <div>
              <div className="nv-search relative" style={{ position: "relative" }}>
                <label className="nv-sr-only" htmlFor={searchId}>
                  Search patients by name or code
                </label>
                <Search
                  className="nv-search__icon absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id={searchId}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, code or phone"
                  autoComplete="off"
                  enterKeyHint="search"
                  inputMode="search"
                  className="nv-input nv-input--icon w-full"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <div
          role="tabpanel"
          id={`nv-tabpanel-${tab}`}
          aria-labelledby={`nv-tab-${tab}`}
          aria-busy={busy}
          className="flex flex-col gap-3"
        >
          {tab === "patients" ? (
            patients === undefined ? (
              <LoadingBlock label="Loading saved entries…" />
            ) : patients.length === 0 ? (
              deferredSearch.trim() ? (
                <div className="nv-empty" aria-live="polite">
                  <p className="text-sm font-semibold">
                    No patients match “{deferredSearch.trim()}”.
                  </p>
                  <p className="text-[13px]" style={{ color: INK_2 }}>
                    Search by full name, patient code or phone number.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="nv-btn nv-btn--quiet inline-flex min-h-11 items-center justify-center"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="nv-empty" aria-live="polite">
                  <p className="text-sm font-semibold">No patients yet — start a screening</p>
                  <p className="text-[13px]" style={{ color: INK_2 }}>
                    Saved patients appear here after their first entry is registered.
                  </p>
                  <button
                    type="button"
                    onClick={onStartScreening}
                    className="nv-btn nv-btn--primary inline-flex min-h-12 w-full items-center justify-center"
                  >
                    Start a screening
                  </button>
                </div>
              )
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="nv-section__title">Saved patients</h2>
                  <span className="nv-section__hint">
                    {patients.length} {patients.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <div className="nv-rows">
                  {patients.map((patient, index) => {
                    const latestScreening = latestByPatient.get(patient._id) ?? null;
                    const status = derivePatientStatus(latestScreening);
                    return (
                      <motion.button
                        key={patient._id}
                        type="button"
                        onClick={() => selectPatient(patient)}
                        className="nv-row flex w-full items-center justify-between gap-3 text-left font-[inherit]"
                        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: reducedMotion ? 0 : 0.24,
                          delay: reducedMotion ? 0 : Math.min(index, 8) * 0.02,
                          ease: EASE,
                        }}
                      >
                        <span className="nv-row__main min-w-0">
                          <span className="nv-row__title block truncate font-bold">
                            {displayName(patient.fullName, "Unnamed patient")}
                          </span>
                          <span className="nv-row__meta block truncate">
                            {sexLabel(patient.sex)} · {formatAge(patient.age)} ·{" "}
                            {patient.village?.trim() || "No village recorded"}
                          </span>
                        </span>
                        <span className="nv-row__right flex flex-col">
                          <span
                            className="text-[11px] font-medium leading-none"
                            style={{ color: INK_2 }}
                          >
                            <span className="nv-sr-only">
                              {latestScreening ? "Screened on " : "Registered on "}
                            </span>
                            {formatEntryDate(
                              latestScreening
                                ? latestScreening._creationTime
                                : patient._creationTime,
                            )}
                          </span>
                          {queue === undefined ? (
                            <span className="nv-badge nv-badge--neutral">Status…</span>
                          ) : (
                            <StatusBadge status={status} />
                          )}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
                <p className="nv-section__hint">
                  Status and visit date come from each patient&apos;s latest screening in the
                  review queue (the 100 most recent screenings in the workspace); patients with no
                  screening in that window show their registration date.
                </p>
              </>
            )
          ) : queue === undefined ? (
            <LoadingBlock label="Loading doctor reviews…" />
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="nv-section__title">Specialist queue</h2>
                <span className="nv-section__hint">
                  {totalQueue} {totalQueue === 1 ? "screening" : "screenings"}
                </span>
              </div>

              <div
                className="nv-chips -mx-1 overflow-x-auto px-1"
                role="group"
                aria-label="Filter reviews by review status"
              >
                {FILTERS.map(({ id, label }) => {
                  const active = filter === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(id)}
                      className={`nv-chip inline-flex min-h-11 shrink-0 items-center gap-1.5 ${
                        active ? "nv-chip--on" : ""
                      }`}
                    >
                      <span>{label}</span>
                      <span className="nv-tab__count" aria-hidden="true">
                        {filterCounts[id]}
                      </span>
                      <span className="nv-sr-only">
                        {filterCounts[id]} {label === "All" ? "screenings" : label.toLowerCase()}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="nv-section__hint">
                The review queue is not yet scoped by district or role — it lists the 100 most
                recent screenings in the workspace.
              </p>

              {visibleReviews.length === 0 ? (
                <p className="nv-empty" aria-live="polite">
                  {totalQueue === 0
                    ? "No screenings in the review queue yet."
                    : "No screenings match this review status."}
                </p>
              ) : (
                <div className="nv-rows">
                  {visibleReviews.map((row, index) => {
                    const status = derivePatientStatus(row.screening);
                    return (
                      <motion.button
                        key={row.screening._id}
                        type="button"
                        onClick={() => setSelection({ kind: "queue", row })}
                        className="nv-row flex w-full items-center justify-between gap-3 text-left font-[inherit]"
                        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: reducedMotion ? 0 : 0.24,
                          delay: reducedMotion ? 0 : Math.min(index, 8) * 0.02,
                          ease: EASE,
                        }}
                      >
                        <span className="nv-row__main min-w-0">
                          <span className="nv-row__title block truncate font-bold">
                            {displayName(row.patient.fullName, "Unnamed patient")}
                          </span>
                          <span className="nv-row__meta block truncate">
                            {row.patient.patientCode?.trim() || "No patient code"} ·{" "}
                            {row.patient.village?.trim() || "No village recorded"}
                          </span>
                        </span>
                        <span className="nv-row__right flex flex-col">
                          <span
                            className="text-[11px] font-medium leading-none"
                            style={{ color: INK_2 }}
                          >
                            <span className="nv-sr-only">Submitted on </span>
                            {formatEntryDate(row.screening._creationTime)}
                          </span>
                          <StatusBadge status={status} />
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {selection ? (
            <div ref={panelRef} tabIndex={-1} className="scroll-mt-3 outline-none">
              <PatientFeedbackPanel
                patient={selection.kind === "queue" ? selection.row.patient : selection.patient}
                screening={
                  selection.kind === "queue" ? selection.row.screening : selection.screening
                }
                onBack={() => setSelection(null)}
              />
            </div>
          ) : null}
        </div>
      </div>

      <footer className="nv-footer">
        <button
          type="button"
          onClick={onBack}
          className="nv-btn nv-btn--quiet inline-flex min-h-12 items-center gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Home
        </button>
      </footer>
    </>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div aria-live="polite" aria-busy="true" className="flex flex-col gap-2">
      <p className="nv-hint">{label}</p>
      <div className="nv-rows" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="nv-row opacity-60">
            <span className="nv-row__main flex w-full flex-col gap-2">
              <span
                className="block h-3 w-1/2 rounded-full"
                style={{ background: "var(--nv-line)" }}
              />
              <span
                className="block h-2.5 w-2/3 rounded-full"
                style={{ background: "var(--nv-line)" }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
