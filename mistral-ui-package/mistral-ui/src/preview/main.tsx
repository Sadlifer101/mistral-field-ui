/**
 * Entry point for the development-only visual preview.
 *
 * Served at:
 *   /preview.html        -> specialist console (home, directory, diagnostic, sign-off)
 *   /nurse.html          -> nurse field unit (registration, recording, follow-up)
 *
 * Both reuse the real App and screen components; only the Convex data layer is
 * replaced (see the shims). Never part of a production build.
 *
 * Vite's html fallback resolves the extension-less /nurse route to this file, so
 * a dev-only middleware in vite.config.ts rewrites /nurse to index.html to keep
 * the real field-unit entry point reachable.
 *
 * The shims are only aliased under `--mode preview`, so opening these pages from
 * a normal `npm run dev` server renders the real Convex provider-less App and
 * throws. The boundary below turns that into instructions instead of a blank
 * screen.
 */
import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "../App";
import "../index.css";

class HarnessBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "32px 20px",
          background: "#FAF9F6",
          color: "#111315",
          font: "400 14px/1.6 system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <p style={{ margin: "0 0 6px", font: "600 11px/1.4 system-ui", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B7266" }}>
            Preview harness
          </p>
          <h1 style={{ margin: "0 0 12px", font: "600 22px/1.25 Georgia, serif" }}>This page needs the preview server</h1>
          <p style={{ margin: "0 0 14px" }}>
            The preview pages swap the Convex data layer for fixtures, and that swap is only applied when
            Vite runs in preview mode. Start it with <code>npm run dev:preview</code> and open{" "}
            <code>/nurse.html</code> (field unit) or <code>/preview.html</code> (specialist console).
          </p>
          <p style={{ margin: "0 0 14px" }}>
            For the real field unit against Convex, run <code>npm run dev</code> and open <code>/nurse</code>.
          </p>
          <pre
            style={{
              margin: 0,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(17,19,21,0.06)",
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {String(this.state.error)}
          </pre>
        </div>
      </div>
    );
  }
}

const badge = document.createElement("div");
badge.textContent = "PREVIEW • simulated data • no backend writes";
badge.style.cssText = [
  "position:fixed",
  "right:12px",
  "bottom:12px",
  "z-index:2147483647",
  "pointer-events:none",
  "background:#111315",
  "color:#F8FAFC",
  "border:1px solid rgba(248,250,252,0.25)",
  "border-radius:9999px",
  "padding:6px 12px",
  "font:600 10px/1.4 system-ui,sans-serif",
  "letter-spacing:0.06em",
  "text-transform:uppercase",
  "opacity:0.88",
  "box-shadow:0 4px 14px rgba(0,0,0,0.3)",
].join(";");
document.body.appendChild(badge);

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <HarnessBoundary>
      <App />
    </HarnessBoundary>,
  );
}
