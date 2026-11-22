/**
 * Mistral — nurse shell.
 *
 * Owns the page frame only: the `.nv-app` token scope, the meadow backdrop, the
 * header, and the scroll region. Business logic, Convex calls and step state
 * stay in the orchestrator; this file never fetches anything.
 *
 * Header follows reference image 1: the "Mistral" wordmark on the left, a sync
 * pill on the right whose tone and label come straight from the real
 * `connection` prop (no invented status), then a quiet identity/action row —
 * "Back to home" only when `flow !== "home"`, and an always-available 44px
 * sign-out control.
 *
 * The header is intentionally NOT sticky: scrolling content can never pass
 * under it. `nurse.css` is imported here and only here.
 */
import "./nurse.css";
import { ArrowLeft, Check, CloudOff, LogOut, RefreshCw, UserRound } from "lucide-react";
import { MeadowBackdrop } from "./MeadowBackdrop";
import type { ConnectionState, NurseShellProps } from "./contract";

const SYNC_LABEL: Record<ConnectionState, string> = {
  live: "Synced",
  connecting: "Connecting",
  offline: "Offline",
};

export function NurseShell({
  children,
  flow,
  nurseName,
  connection,
  onHome,
  onSignOut,
  animateBackdrop,
}: NurseShellProps) {
  return (
    <div className="nv-app">
      <MeadowBackdrop variant={animateBackdrop ? "animated" : "static"} />

      <div className="nv-shell">
        <header className="nv-header">
          <div className="nv-brand">
            <span className="nv-brand-word">Mistral</span>
          </div>

          <span
            className={`nv-sync nv-sync--${connection}`}
            role="status"
            aria-live="polite"
          >
            {connection === "live" ? (
              <span className="nv-sync__mark" aria-hidden="true">
                <Check size={11} strokeWidth={3.4} />
              </span>
            ) : connection === "connecting" ? (
              <RefreshCw
                className="nv-sync__glyph"
                size={14}
                strokeWidth={2.2}
                aria-hidden="true"
              />
            ) : (
              <CloudOff
                className="nv-sync__glyph"
                size={14}
                strokeWidth={2.1}
                aria-hidden="true"
              />
            )}
            <span className="nv-sr-only">Connection: </span>
            {SYNC_LABEL[connection]}
          </span>

          {nurseName ? (
            <p className="nv-header-user">
              <UserRound size={14} strokeWidth={2} aria-hidden="true" />
              <span>{nurseName}</span>
            </p>
          ) : null}

          <div className="nv-header-actions">
            {flow !== "home" ? (
              <button
                type="button"
                className="nv-btn nv-btn--quiet nv-btn--sm"
                onClick={onHome}
                aria-label="Back to home"
              >
                <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
                Home
              </button>
            ) : null}
            <button
              type="button"
              className="nv-iconbtn"
              onClick={onSignOut}
              aria-label="Sign out"
            >
              <LogOut size={18} strokeWidth={1.9} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="nv-main">{children}</main>
      </div>
    </div>
  );
}
