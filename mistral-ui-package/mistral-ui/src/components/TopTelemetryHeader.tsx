import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
/**
 * TopTelemetryHeader
 * -----------------------------------------------------------------------------
 * Floating masthead chrome for the Mistral specialist console.
 *
 * The bar is deliberately transparent: no fill, no bottom rule, no page
 * background of its own — it floats over the fluid field so the glass capsule
 * and ghost controls are the only things that catch light.
 *
 * The atoms (brand lockup, ghost icon button, module switcher, doctor chip) are
 * exported so `SpecialistShell` can compose the same chrome around its tab
 * capsule instead of growing a second visual language.
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Bell,
  ChevronDown,
  ExternalLink,
  LayoutGrid,
  LogOut,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { ACCENT, glass, LAYOUT, type ThemeMode } from "../theme/glass";

/* ------------------------------------------------------------------ tokens -- */

/**
 * Custom properties the chrome utilities read from.
 *
 * They are driven by the `theme` prop rather than the `.dark` class so hover
 * washes and focus rings stay in sync with the mode the shell is rendered in.
 */
export function shellVars(theme: ThemeMode): CSSProperties {
  const tokens = glass(theme);
  return {
    color: tokens.text.primary,
    "--sh-focus": ACCENT.solid,
    "--sh-ink": tokens.text.primary,
    "--sh-ink-muted": tokens.text.secondary,
    "--sh-ink-faint": tokens.text.muted,
    /* Selection label: near-white on the dark field, ink on the day surface. */
    "--sh-accent-ink": theme === "dark" ? ACCENT.ink : tokens.text.primary,
    "--sh-hover-wash":
      theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(17,19,21,0.05)",
  } as CSSProperties;
}

/** Lavender focus ring — required on every interactive element in the chrome. */
export const SHELL_FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sh-focus)]";

/** Faint wash + ink lift used by every ghost control. */
export const SHELL_HOVER =
  "hover:bg-[var(--sh-hover-wash)] hover:text-[color:var(--sh-ink)]";

/** Wash without the ink change, for controls that keep their own colour. */
export const SHELL_WASH_HOVER = "hover:bg-[var(--sh-hover-wash)]";

/* ------------------------------------------------------------------ helpers -- */

/** First + last initials, ignoring honorifics so "Dr. A. Mehra" reads "AM". */
function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !/^(dr|mr|mrs|ms|prof)\.?$/i.test(word));
  if (words.length === 0) return "";
  if (words.length === 1) return (words[0] ?? "").charAt(0).toUpperCase();
  const first = words[0] ?? "";
  const last = words[words.length - 1] ?? "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/* -------------------------------------------------------------------- brand -- */

export interface MistralBrandProps {
  theme: ThemeMode;
  onLogoClick?: () => void;
  className?: string;
}

/** Wordmark lockup only — the whole thing is one button. */
export function MistralBrand({ theme, onLogoClick, className }: MistralBrandProps) {
  const tokens = glass(theme);

  return (
    <button
      type="button"
      onClick={onLogoClick}
      aria-label="Mistral — go to overview"
      className={`inline-flex min-w-0 shrink items-center rounded-2xl text-left ${SHELL_FOCUS} ${
        className ?? ""
      }`}
    >
      <span
        className="font-serif text-[34px] font-semibold leading-none tracking-[-0.01em]"
        style={{ color: tokens.text.primary }}
      >
        Mistral
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------- controls -- */

export interface HeaderIconButtonProps {
  label: string;
  title?: string;
  onClick?: () => void;
  /** Renders the 4px notification dot. */
  badge?: boolean;
  /** Dot colour; defaults to the lavender accent. */
  badgeColor?: string;
  children: ReactNode;
}

/** 36px ghost icon button with an optional dot. */
export function HeaderIconButton({
  label,
  title,
  onClick,
  badge = false,
  badgeColor,
  children,
}: HeaderIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      className={`sp-icon-button relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent text-[color:var(--sh-ink-muted)] transition-colors duration-200 ${SHELL_HOVER} ${SHELL_FOCUS}`}
    >
      {children}
      {badge ? (
        <span
          aria-hidden="true"
          className="absolute right-[7px] top-[7px] h-[5px] w-[5px] rounded-full"
          style={{ backgroundColor: badgeColor ?? ACCENT.solid }}
        />
      ) : null}
    </button>
  );
}

export interface DoctorChipProps {
  theme: ThemeMode;
  doctorName: string;
  onSignOut: () => void;
}

// Adapted from UI Forge shadcn/dropdown-menu: portal, collision-aware alignment
// and highlighted items driven by the same primitive for pointer and keyboard.
export function DoctorChip({ theme, doctorName, onSignOut }: DoctorChipProps) {
  const [open, setOpen] = useState(false);
  const tokens = glass(theme);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger aria-label={`Account menu — ${doctorName}`}
        className={`sp-account-trigger flex shrink-0 items-center gap-[9px] rounded-full py-1 pl-1 pr-2 ${SHELL_WASH_HOVER} ${SHELL_FOCUS}`}
        style={{ color: tokens.text.primary }}>
        <span aria-hidden="true" className="sp-account-avatar grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[11px] font-semibold tracking-[0.06em]"
          style={{ backgroundColor: ACCENT.wash, color: theme === "dark" ? ACCENT.text : tokens.text.primary }}>
          {getInitials(doctorName) || "·"}
        </span>
        <span className="hidden whitespace-nowrap text-[15px] font-medium tracking-[-0.01em] min-[1650px]:inline">
          {doctorName}
        </span>
        <ChevronDown size={15} aria-hidden="true" className="sp-chevron shrink-0" style={{ color: tokens.text.secondary }} />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} collisionPadding={12} aria-label="Account"
          className="sp-popup sp-account-popup sp-popup-items" data-theme={theme} style={tokens.surface}>
          <DropdownMenu.Item asChild>
            <a href="/nurse" target="_blank" rel="noreferrer" className="sp-popup-item" onClick={() => setOpen(false)}>
              <span className="sp-account-icon"><ExternalLink size={15} aria-hidden="true" /></span>
              <span>Nurse field app</span>
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="sp-popup-separator" />
          <DropdownMenu.Item onSelect={onSignOut} className="sp-popup-item">
            <span className="sp-account-icon"><LogOut size={15} aria-hidden="true" /></span>
            <span>Sign out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export interface HeaderControlsProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onSignOut: () => void;
  doctorName?: string;
  /** Module switcher entries; omitted on surfaces without a tab set. */
  onNavigate?: (target: "triage" | "patients" | "analytics") => void;
  onSearch?: () => void;
}

/**
 * Right-hand cluster: search, notifications, day/night, module switcher,
 * account chip. Shared by the shell and the standalone header so the two never
 * drift.
 */
export function HeaderControls({
  theme,
  onToggleTheme,
  onSignOut,
  doctorName,
  onNavigate,
  onSearch,
}: HeaderControlsProps) {
  const isDark = theme === "dark";
  const tokens = glass(theme);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const alertsWrapRef = useRef<HTMLDivElement | null>(null);
  const modulesWrapRef = useRef<HTMLDivElement | null>(null);

  /**
   * Shortcut into the triage queue's own filter field. The field is collapsed in
   * the queue until something asks for it, so the shortcut announces itself and
   * lets the queue open + focus it.
   */
  const focusQueueSearch = () => {
    window.dispatchEvent(new CustomEvent("mistral:queue-search"));
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Search triage queue"]',
    );
    if (!input) return;
    input.scrollIntoView({ block: "nearest" });
    input.focus();
  };

  useEffect(() => {
    if (!alertsOpen && !modulesOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node) {
        if (alertsWrapRef.current?.contains(target)) return;
        if (modulesWrapRef.current?.contains(target)) return;
      }
      setAlertsOpen(false);
      setModulesOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAlertsOpen(false);
      setModulesOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [alertsOpen, modulesOpen]);

  const modules: ReadonlyArray<{ id: "triage" | "patients" | "analytics"; label: string }> = [
    { id: "triage", label: "Triage review" },
    { id: "patients", label: "Patient directory" },
    { id: "analytics", label: "District analytics" },
  ];

  return (
    <div className={onSearch ? "sp-header-controls flex items-center gap-2" : "flex items-center gap-4"}>
      <HeaderIconButton label={onSearch ? "Search screenings or patients" : "Search triage queue"} onClick={onSearch ?? focusQueueSearch}>
        <Search size={18} aria-hidden="true" />
      </HeaderIconButton>

      {!onSearch && <div ref={alertsWrapRef} className="relative shrink-0">
        <HeaderIconButton
          label="Notifications"
          title="Notifications"
          badge
          badgeColor="#EC7A5C"
          onClick={() => setAlertsOpen((value) => !value)}
        >
          <Bell size={18} aria-hidden="true" />
        </HeaderIconButton>
        {alertsOpen ? (
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[236px] p-3"
            style={{ ...tokens.surface, borderRadius: 14 }}
          >
            <p className="text-[12px] font-medium" style={{ color: tokens.text.primary }}>
              No new alerts
            </p>
            <p
              className="mt-1 text-[11px] leading-relaxed"
              style={{ color: tokens.text.muted }}
            >
              Field clinic escalations will appear here.
            </p>
          </div>
        ) : null}
      </div>

      }
      <HeaderIconButton
        label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Light mode" : "Night mode"}
        onClick={onToggleTheme}
      >
        {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      </HeaderIconButton>

      {onNavigate ? (
        <div ref={modulesWrapRef} className="relative hidden shrink-0 min-[1500px]:block">
          <HeaderIconButton
            label="Switch module"
            title="Switch module"
            onClick={() => setModulesOpen((value) => !value)}
          >
            <LayoutGrid size={18} aria-hidden="true" />
          </HeaderIconButton>
          {modulesOpen ? (
            <div
              role="menu"
              aria-label="Modules"
              className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[196px] p-1.5"
              style={{ ...tokens.surface, borderRadius: 14 }}
            >
              {modules.map((module) => (
                <button
                  key={module.id}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setModulesOpen(false);
                    onNavigate(module.id);
                  }}
                  className={`flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[13px] ${SHELL_WASH_HOVER} ${SHELL_FOCUS}`}
                  style={{ color: tokens.text.primary }}
                >
                  {module.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <span
        aria-hidden="true"
        className="mx-1 h-6 w-px shrink-0"
        style={{ backgroundColor: tokens.hairline }}
      />

      {doctorName ? (
        <DoctorChip theme={theme} doctorName={doctorName} onSignOut={onSignOut} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ header -- */

export interface TopTelemetryHeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSignOut: () => void;
  onLogoClick?: () => void;
  /** Optional: when present the account chip is rendered. */
  doctorName?: string;
}

/**
 * Standalone floating header (brand + right cluster, no tab capsule). The shell
 * uses the exported atoms directly so it can slot its nav between them.
 */
export function TopTelemetryHeader({
  theme,
  onToggleTheme,
  onSignOut,
  onLogoClick,
  doctorName,
}: TopTelemetryHeaderProps) {
  const tokens = glass(theme);

  return (
    <header
      className="sticky top-0 z-30"
      style={{ ...shellVars(theme), height: LAYOUT.headerHeight }}
    >
      <div
        className="mx-auto flex h-full items-center justify-between gap-6"
        style={{ maxWidth: LAYOUT.maxWidth, paddingInline: LAYOUT.pagePaddingX }}
      >
        <MistralBrand theme={theme} onLogoClick={onLogoClick} />

        <div className="flex shrink-0 items-center gap-[18px]">
          <a
            href="/nurse"
            target="_blank"
            rel="noreferrer"
            className={`hidden shrink-0 rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-200 sm:inline-flex ${SHELL_WASH_HOVER} ${SHELL_FOCUS}`}
            style={{ border: `1px solid ${tokens.hairline}`, color: tokens.text.secondary }}
          >
            Open Nurse Field App ↗
          </a>

          <HeaderControls
            theme={theme}
            onToggleTheme={onToggleTheme}
            onSignOut={onSignOut}
            doctorName={doctorName}
          />
        </div>
      </div>
    </header>
  );
}
