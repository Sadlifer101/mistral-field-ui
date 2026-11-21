/**
 * Mistral Field — nurse shell.
 *
 * Owns the page frame only: the `.nv-app` token scope, the meadow backdrop, the
 * header, and the scroll region. Business logic, Convex calls and step state
 * stay in the orchestrator; this file never fetches anything.
 *
 * Header follows reference image 1: the olive leaf mark above the "Mistral
 * Field" wordmark on the left, a sync pill on the right whose tone and label
 * come straight from the real `connection` prop (no invented status), then a
 * quiet identity/action row — "Back to home" only when `flow !== "home"`, and an
 * always-available 44px sign-out control.
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
            <svg
              className="nv-brand-mark"
              viewBox="0 0 34 24"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M2.2 19.6c4.2-4.6 9.3-7 14.8-6.7 4.9.3 9.2 2.1 12.9 5"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
              <path
                d="M5.4 14.4c3.9-4.2 8.6-6.4 13.6-6.1 4.2.3 7.9 1.8 11 4.2"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
              <path
                d="M8.8 9.2c3.5-3.7 7.6-5.5 11.9-5.2 3.4.2 6.4 1.3 8.8 3.1"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </svg>
            <span className="nv-brand-word">Mistral Field</span>
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
