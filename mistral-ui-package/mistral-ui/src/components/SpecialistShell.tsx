import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  Stethoscope,
  Users,
} from "lucide-react";
import FluidBackdrop from "./FluidBackdrop";
import { ACCENT, glass } from "../theme/glass";
import {
  HeaderControls,
  MistralBrand,
  SHELL_FOCUS,
  SHELL_HOVER,
  shellVars,
} from "./TopTelemetryHeader";

/* -------------------------------------------------------------------- types -- */

export type ShellTab = "triage" | "patients" | "reviews" | "referrals" | "analytics";

export interface SpecialistShellProps {
  theme: "light" | "dark";
  activeTab: ShellTab;
  onTabChange: (tab: ShellTab) => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onLogoClick: () => void;
  onSearch: () => void;
  doctorName: string;
  children: ReactNode;
}

type TabIcon = typeof Stethoscope;

interface TabSpec {
  id: ShellTab;
  label: string;
  Icon: TabIcon;
}

interface PillBox {
  left: number;
  width: number;
}

/* --------------------------------------------------------------- constants -- */

const TABS: readonly TabSpec[] = [
  { id: "triage", label: "Dashboard", Icon: Stethoscope },
  { id: "patients", label: "Patients", Icon: Users },
  { id: "reviews", label: "Reviews", Icon: ClipboardList },
  { id: "referrals", label: "Referrals", Icon: ArrowLeftRight },
  { id: "analytics", label: "Analytics", Icon: BarChart3 },
];

/** Item geometry measured off the approved reference (60px capsule, 48px pill). */
const NAV_HEIGHT = 53;
const NAV_PADDING = 6;
const NAV_ITEM_HEIGHT = 41;

/** Hidden scrollbar for the nav capsule (it scrolls, it never shows a bar). */
const HIDDEN_SCROLLBAR =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

/* ------------------------------------------------------------------ helpers -- */

/**
 * Reads the OS reduced-motion setting. Re-reads on change so a user flipping the
 * preference mid-session does not keep a 420ms slide.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/* -------------------------------------------------------------------- shell -- */

export function SpecialistShell({
  theme,
  activeTab,
  onTabChange,
  onToggleTheme,
  onSignOut,
  onLogoClick,
  onSearch,
  doctorName,
  children,
}: SpecialistShellProps) {
  const tokens = glass(theme);
  const reducedMotion = usePrefersReducedMotion();
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<ShellTab, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<PillBox | null>(null);

  /* The document becomes a transparent canvas for the fluid field. */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("mistral-console");
    return () => {
      root.classList.remove("mistral-console");
    };
  }, []);

  /* --------------------------------------------------------- the indicator -- */

  /**
   * Measures the selected item. Runs only on mount, on resize (ResizeObserver)
   * and on tab change — never on pointer movement. Values are compared before
   * they are stored so a resize tick cannot bounce the state update loop.
   */
  const measure = useCallback(() => {
    const list = tablistRef.current;
    const active = tabRefs.current[activeTab];
    if (!list || !active) return;

    const left = active.offsetLeft - list.clientLeft;
    const width = active.offsetWidth;

    setPill((previous) =>
      previous &&
      Math.abs(previous.left - left) < 0.5 &&
      Math.abs(previous.width - width) < 0.5
        ? previous
        : { left, width },
    );
  }, [activeTab]);

  useLayoutEffect(() => {
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    if (tablistRef.current) observer.observe(tablistRef.current);
    // Every item is observed, not just the selected one: a webfont swap that
    // widens an earlier label shifts the pill without changing its own width.
    for (const tab of TABS) {
      const node = tabRefs.current[tab.id];
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [measure, activeTab]);

  /* Keep the selection visible when the capsule is in its scrolling range. */
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    tabRefs.current[activeTab]?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeTab]);

  /* ------------------------------------------------------------ keyboard -- */

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const focused = TABS.findIndex((tab) => tabRefs.current[tab.id] === event.target);
    const currentIndex = focused < 0 ? TABS.findIndex((tab) => tab.id === activeTab) : focused;
    const from = currentIndex < 0 ? 0 : currentIndex;
    let next: number;

    switch (event.key) {
      case "ArrowRight":
        next = (from + 1) % TABS.length;
        break;
      case "ArrowLeft":
        next = (from - 1 + TABS.length) % TABS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = TABS.length - 1;
        break;
      default:
        return;
    }

    const target = TABS[next];
    if (!target) return;

    event.preventDefault();
    tabRefs.current[target.id]?.focus();
  };

  /* ----------------------------------------------------------------- render -- */

  return (
    <div className="relative min-h-dvh" style={shellVars(theme)}>
      {theme === "dark" ? <FluidBackdrop /> : null}

      <header className="sp-masthead">
        <div className="sp-masthead-inner">
          <MistralBrand theme={theme} onLogoClick={onLogoClick} className="justify-self-start" />

          <div
            ref={tablistRef}
            role="navigation"
            aria-label="Specialist sections"
            onKeyDown={handleTabKeyDown}
            className={`sp-shell-nav relative flex min-w-0 max-w-full items-center gap-[2px] justify-self-center overflow-x-auto overscroll-x-contain ${HIDDEN_SCROLLBAR}`}
            style={{
              ...tokens.surface,
              borderRadius: 9999,
              padding: NAV_PADDING,
              height: NAV_HEIGHT,
            }}
          >
            {pill ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0"
                style={{
                  ...tokens.active,
                  position: "absolute",
                  top: NAV_PADDING,
                  height: NAV_ITEM_HEIGHT,
                  borderRadius: 9999,
                  background: ACCENT.wash,
                  zIndex: 0,
                  width: pill.width,
                  transform: `translateX(${pill.left}px)`,
                  willChange: reducedMotion ? undefined : "transform",
                  transition: reducedMotion
                    ? "none"
                    : "transform 260ms var(--sp-ease), width 260ms var(--sp-ease)",
                }}
              />
            ) : null}

            {TABS.map(({ id, label, Icon }) => {
              const selected = id === activeTab;
              return (
                <button
                  key={id}
                  ref={(node) => {
                    tabRefs.current[id] = node;
                  }}
                  type="button"
                  id={`shell-tab-${id}`}
                  aria-current={selected ? "page" : undefined}
                  onClick={() => onTabChange(id)}
                  className={`relative z-10 inline-flex shrink-0 items-center gap-[10px] whitespace-nowrap rounded-full bg-transparent px-[clamp(12px,1.1vw,20px)] text-[14px] font-medium tracking-[-0.01em] transition-colors duration-200 ${
                    selected
                      ? "text-[color:var(--sh-accent-ink)]"
                      : `text-[color:var(--sh-ink-muted)] ${SHELL_HOVER}`
                  } ${SHELL_FOCUS}`}
                  style={{ height: NAV_ITEM_HEIGHT }}
                >
                  <Icon size={17} aria-hidden="true" className="shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center justify-self-end">
            <HeaderControls
              theme={theme}
              onToggleTheme={onToggleTheme}
              onSignOut={onSignOut}
              doctorName={doctorName}
              onSearch={onSearch}
            />
          </div>
        </div>
      </header>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
