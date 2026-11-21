/**
 * Development-only motion preview for <FluidBackdrop />.
 *
 * Served at /motion.html on the preview dev server (npm run dev:preview).
 * Renders the animated backdrop fullscreen with three translucent glass panels
 * above it, plus a small dev control strip for motion on/off, reduced
 * intensity and the cursor-response tuning values. Deliberately isolated: no
 * Convex, no auth, no application state, no import of index.css (the root
 * background must stay transparent so the backdrop layer is visible).
 *
 * The tuning sliders only feed shader uniforms / time constants, so moving them
 * never recompiles the shader.
 *
 * Like the other preview entries this file is not part of a production build -
 * vite only builds index.html.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import FluidBackdrop from "../../components/FluidBackdrop";

const WEBGL2_AVAILABLE = (() => {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
})();

const SANS = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const panelStyle: CSSProperties = {
  position: "relative",
  minWidth: 0,
  padding: "26px 26px 24px",
  borderRadius: 20,
  border: "1px solid rgba(232,226,248,0.10)",
  background:
    "linear-gradient(158deg, rgba(255,255,255,0.060) 0%, rgba(255,255,255,0.014) 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.07), 0 30px 70px -34px rgba(0,0,0,0.9)",
  backdropFilter: "blur(20px) saturate(118%)",
  WebkitBackdropFilter: "blur(20px) saturate(118%)",
  color: "#EFEBF7",
};

function Panel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={panelStyle}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(226,219,244,0.52)",
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          margin: "12px 0 0",
          fontFamily: SERIF,
          fontSize: 24,
          fontWeight: 600,
          lineHeight: 1.15,
        }}
      >
        {title}
      </h2>
      <div style={{ marginTop: 18 }}>{children}</div>
    </section>
  );
}

function Meter({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontFamily: SANS,
          fontSize: 11,
          fontWeight: 500,
          color: "rgba(232,226,248,0.70)",
        }}
      >
        <span>{label}</span>
        <span style={{ fontFamily: MONO, color: "rgba(232,226,248,0.92)" }}>{value}</span>
      </div>
      <div
        style={{
          marginTop: 7,
          height: 4,
          borderRadius: 999,
          background: "rgba(255,255,255,0.09)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.round(ratio * 100)}%`,
            height: "100%",
            borderRadius: 999,
            background:
              "linear-gradient(90deg, rgba(178,162,214,0.50) 0%, rgba(214,201,238,0.85) 100%)",
          }}
        />
      </div>
    </div>
  );
}

const toggleStyle = (active: boolean): CSSProperties => ({
  appearance: "none",
  cursor: "pointer",
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${active ? "rgba(198,184,232,0.42)" : "rgba(232,226,248,0.14)"}`,
  background: active ? "rgba(178,162,214,0.20)" : "rgba(255,255,255,0.04)",
  color: active ? "#F2EDFF" : "rgba(232,226,248,0.62)",
  fontFamily: SANS,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.01em",
  lineHeight: 1.2,
});

function TuningSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (next: number) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 3, minWidth: 0 }}>
      <span
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "rgba(226,219,244,0.54)",
        }}
      >
        <span>{label}</span>
        <span style={{ color: "rgba(240,235,252,0.88)" }}>{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: "100%", accentColor: "#B2A2D6", cursor: "pointer", height: 14 }}
      />
    </label>
  );
}

// Tuned defaults - the preview starts on exactly the values the component ships.
const DEFAULTS = {
  radius: 0.95,
  strength: 0.24,
  inertia: 0.9,
  sensitivity: 1,
};

function MotionPreview() {
  const [motionOn, setMotionOn] = useState(true);
  const [reducedIntensity, setReducedIntensity] = useState(false);
  const [ignoreOsReducedMotion, setIgnoreOsReducedMotion] = useState(false);
  const [osPrefersReduced, setOsPrefersReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const [cursorRadius, setCursorRadius] = useState(DEFAULTS.radius);
  const [cursorStrength, setCursorStrength] = useState(DEFAULTS.strength);
  const [cursorInertia, setCursorInertia] = useState(DEFAULTS.inertia);
  const [cursorSensitivity, setCursorSensitivity] = useState(DEFAULTS.sensitivity);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setOsPrefersReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const intensity = reducedIntensity ? 0.35 : 1;
  const respectingOs = !ignoreOsReducedMotion && osPrefersReduced;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      <FluidBackdrop
        motion={intensity}
        paused={!motionOn}
        respectReducedMotion={!ignoreOsReducedMotion}
        interactive
        cursorRadius={cursorRadius}
        cursorStrength={cursorStrength}
        cursorSensitivity={cursorSensitivity}
        cursorInertia={cursorInertia}
        fps={30}
        maxDpr={1.5}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "grid",
          gridTemplateRows: "auto 1fr",
          padding: "clamp(18px, 3vw, 40px)",
          gap: "clamp(18px, 3vh, 34px)",
        }}
      >
        <header>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(198,184,232,0.62)",
            }}
          >
            Dev preview · not in production build
          </div>
          <h1
            style={{
              margin: "10px 0 0",
              fontFamily: SERIF,
              fontSize: "clamp(26px, 3.2vw, 40px)",
              fontWeight: 600,
              lineHeight: 1.1,
              color: "#F4F1FA",
            }}
          >
            Fluid Backdrop
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              maxWidth: 520,
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 400,
              lineHeight: 1.55,
              color: "rgba(232,226,248,0.58)",
            }}
          >
            Atmospheric light drifting beneath frosted glass. Move the cursor to bend and
            stretch the surrounding flow; the deformation keeps travelling for a moment
            after you stop, then settles.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            alignContent: "center",
            gap: "clamp(14px, 2vw, 22px)",
            minHeight: 0,
          }}
        >
          <Panel eyebrow="Case P-1047 · F, 62" title="Respiratory Assessment">
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: 12,
                lineHeight: 1.6,
                color: "rgba(232,226,248,0.62)",
              }}
            >
              Acoustic and clinical features suggest a higher likelihood of a lower
              respiratory tract condition.
            </p>
            <div style={{ marginTop: 16 }}>
              <Meter label="Severity" value="High" ratio={0.72} />
              <Meter label="Confidence" value="0.86" ratio={0.86} />
            </div>
          </Panel>

          <Panel eyebrow="Model estimate" title="Differential">
            <Meter label="Community-acquired pneumonia" value="0.62" ratio={0.62} />
            <Meter label="Acute exacerbation of COPD" value="0.18" ratio={0.18} />
            <Meter label="Acute bronchitis (viral)" value="0.12" ratio={0.12} />
          </Panel>

          <Panel eyebrow="Vitals" title="At Presentation">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {[
                { label: "SpO₂", value: "94%", unit: "" },
                { label: "RR", value: "24", unit: "/min" },
                { label: "Temp", value: "37.8", unit: "°C" },
              ].map((vital) => (
                <div key={vital.label}>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "rgba(226,219,244,0.48)",
                    }}
                  >
                    {vital.label}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontFamily: SERIF,
                      fontSize: 22,
                      fontWeight: 600,
                      lineHeight: 1,
                    }}
                  >
                    {vital.value}
                    <span
                      style={{
                        marginLeft: 3,
                        fontFamily: SANS,
                        fontSize: 10,
                        fontWeight: 500,
                        color: "rgba(232,226,248,0.52)",
                      }}
                    >
                      {vital.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p
              style={{
                margin: "18px 0 0",
                fontFamily: SANS,
                fontSize: 11,
                lineHeight: 1.6,
                color: "rgba(232,226,248,0.44)",
              }}
            >
              Panels are static. Watch the light bend behind their blur — text and
              controls never distort.
            </p>
          </Panel>
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(232,226,248,0.12)",
          background: "rgba(11,10,15,0.72)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          color: "#E6E1F2",
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={toggleStyle(motionOn && !respectingOs)}
            onClick={() => setMotionOn((value) => !value)}
          >
            Motion {motionOn ? "on" : "off"}
          </button>
          <button
            type="button"
            style={toggleStyle(reducedIntensity)}
            onClick={() => setReducedIntensity((value) => !value)}
          >
            {reducedIntensity ? "Intensity 35%" : "Intensity 100%"}
          </button>
          <button
            type="button"
            style={toggleStyle(ignoreOsReducedMotion)}
            onClick={() => setIgnoreOsReducedMotion((value) => !value)}
          >
            Ignore OS reduce
          </button>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              lineHeight: 1.4,
              letterSpacing: "0.03em",
              color: "rgba(226,219,244,0.50)",
            }}
          >
            {WEBGL2_AVAILABLE ? "webgl2" : "css fallback"} · 30fps · dpr≤1.5 · os reduce{" "}
            {osPrefersReduced ? "on" : "off"}
            {respectingOs ? " · paused" : ""}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "8px 16px",
            width: "min(340px, calc(100vw - 56px))",
          }}
        >
          <TuningSlider
            label="Radius"
            value={cursorRadius}
            min={0.3}
            max={1.6}
            step={0.05}
            display={cursorRadius.toFixed(2)}
            onChange={setCursorRadius}
          />
          <TuningSlider
            label="Displacement"
            value={cursorStrength}
            min={0.05}
            max={0.45}
            step={0.01}
            display={cursorStrength.toFixed(2)}
            onChange={setCursorStrength}
          />
          <TuningSlider
            label="Inertia"
            value={cursorInertia}
            min={0.15}
            max={2}
            step={0.05}
            display={cursorInertia.toFixed(2) + "s"}
            onChange={setCursorInertia}
          />
          <TuningSlider
            label="Sensitivity"
            value={cursorSensitivity}
            min={0.3}
            max={2.5}
            step={0.05}
            display={cursorSensitivity.toFixed(2) + "×"}
            onChange={setCursorSensitivity}
          />
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<MotionPreview />);
}
