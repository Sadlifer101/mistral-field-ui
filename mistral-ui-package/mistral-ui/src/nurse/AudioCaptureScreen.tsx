/**
 * Audio capture — step 2 of the nurse flow.
 *
 * OWNER: agent 2. Re-skins the existing guided capture without touching the
 * clinical capture protocol. `EdgeAudioRecorder` is used exactly as the current
 * `MobileNurseApp.CaptureCard` uses it:
 *
 *   const recorder = new EdgeAudioRecorder();      // mime negotiation + FFT
 *   await recorder.start(setBars);                 // live 32-bin spectrum
 *   const left = Math.max(0, 5 - Math.floor((Date.now() - started) / 1000));
 *   timerRef.current = window.setInterval(..., 200);  // 5-second auto-stop
 *   const result = await recorder.stop();          // CaptureResult
 *   recorder.cancel();                             // on unmount
 *   describeMicrophoneError(cause)                 // permission failures
 *
 * The mockup's 0:12 / 0:15 readouts are illustrative: the real capture is the
 * 5-second packet the backend already receives. The duration shown is measured
 * from the real recording window, never a fake counter.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardPlus,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Stethoscope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  EdgeAudioRecorder,
  describeMicrophoneError,
  formatOpusKb,
  type CaptureResult,
} from "../utils/edgeAudioRecorder";
import type {
  AudioCaptureScreenProps,
  AudioChannel,
} from "./contract";
import { NurseStepRail } from "./NurseStepRail";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** The recording protocol is fixed at five seconds; only the copy differs. */
const CAPTURE_SECONDS = 5;

function mmss(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(clamped / 60)}:${String(clamped % 60).padStart(2, "0")}`;
}

function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0 : 0.5,
        delay: reduced ? 0 : delay,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
}

export function AudioCaptureScreen({
  cough,
  phonation,
  onCapture,
  onRetake,
  onError,
  onSubmit,
  onBack,
  submitting,
}: AudioCaptureScreenProps) {
  const reduced = useReducedMotion();

  /* One owner for microphone errors: the orchestrator renders the banner, so this
     screen only forwards. Rendering a second local `role="alert"` announced every
     failure twice and showed two identical messages. */
  const handleError = (message: string) => {
    onError(message);
  };

  const bothCaptured = Boolean(cough && phonation);
  const missing = !cough
    ? "Cough recording is still missing."
    : !phonation
      ? "Voice recording is still missing."
      : null;

  return (
    <div className="nv-page">
      <section className="nv-card" aria-labelledby="nv-audio-title">
        <header className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[var(--nv-r-sm)] bg-[var(--nv-sage)] text-[var(--nv-forest)]"
          >
            <ClipboardPlus className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold leading-none text-[var(--nv-ink-2)]">
              New Entry
            </p>
            <h1
              id="nv-audio-title"
              className="mt-1 text-[clamp(24px,7vw,29px)] font-bold leading-[1.05] tracking-tight text-[var(--nv-ink)]"
            >
              Audio
            </h1>
          </div>
        </header>

        <NurseStepRail current={2} />


        <div className="grid gap-3">
          <Reveal delay={0}>
            <CapturePane
              channel="cough"
              title="Cough recording"
              hint="Record about 10–15 seconds of natural coughing, if possible."
              caption="Captures a 5-second packet, then stops automatically."
              icon={Stethoscope}
              capture={cough}
              onCapture={(result) => onCapture("cough", result)}
              onRetake={() => onRetake("cough")}
              onError={handleError}
            />
          </Reveal>

          <Reveal delay={0.05}>
            <CapturePane
              channel="phonation"
              title="Voice recording"
              hint="Record the patient speaking for about 10–15 seconds (e.g., a few sentences)."
              caption="Captures a 5-second packet, then stops automatically."
              icon={MessageSquare}
              capture={phonation}
              onCapture={(result) => onCapture("phonation", result)}
              onRetake={() => onRetake("phonation")}
              onError={handleError}
            />
          </Reveal>

          <p className="nv-hint">
            Audio stays in memory on this device until you submit — nothing syncs
            in the background.
          </p>
        </div>
      </section>

      <footer className="nv-footer nv-footer--split">
        <p className="nv-hint" id="nv-audio-status">
          {submitting
            ? "Submitting the screening — keep this screen open."
            : missing ?? "Both recordings are ready for review."}
        </p>
        <div className="nv-btn-row">
          <button
            type="button"
            className="nv-btn nv-btn--ghost"
            onClick={onBack}
            disabled={submitting}
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Back to vitals
          </button>
          <motion.button
            type="button"
            className="nv-btn nv-btn--primary"
            disabled={!bothCaptured || submitting}
            aria-describedby="nv-audio-status"
            onClick={onSubmit}
            whileTap={reduced ? undefined : { scale: 0.985 }}
          >
            {submitting ? "Submitting…" : "Review & submit"}
            {!submitting && <ArrowRight aria-hidden className="h-4 w-4" />}
          </motion.button>
        </div>
        <p className="nv-sr-only" role="status" aria-live="polite">
          {submitting ? "Submitting screening…" : ""}
        </p>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------- one card */

function CapturePane({
  channel,
  title,
  hint,
  caption,
  icon: Icon,
  capture,
  onCapture,
  onRetake,
  onError,
}: {
  channel: AudioChannel;
  title: string;
  hint: string;
  caption: string;
  icon: LucideIcon;
  capture: CaptureResult | null;
  onCapture: (result: CaptureResult) => void;
  onRetake: () => void;
  onError: (message: string) => void;
}) {
  const recorderRef = useRef<EdgeAudioRecorder | null>(null);
  /* Guards the getUserMedia window: without it a second tap while the stream is
     still opening replaced `recorderRef` and left the first microphone open. */
  const startingRef = useRef(false);
  const timerRef = useRef<number>(0);
  const startedAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [recording, setRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(CAPTURE_SECONDS);
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: 32 }, () => 0.08),
  );
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");

  const stopPlayback = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      recorderRef.current?.cancel();
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    stopPlayback();
    if (!capture) setDuration(null);
  }, [capture]);

  const finish = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    try {
      const result = await recorder.stop();
      const elapsed = startedAtRef.current
        ? (Date.now() - startedAtRef.current) / 1000
        : 0;
      setDuration(Math.min(CAPTURE_SECONDS, Math.max(1, Math.round(elapsed))));
      onCapture(result);
      setAnnounce("Recording finished and held in memory.");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Recording failed.");
      setAnnounce("Recording failed.");
    } finally {
      window.clearInterval(timerRef.current);
      recorderRef.current = null;
      setRecording(false);
      setSecondsLeft(CAPTURE_SECONDS);
    }
  };

  const start = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    onError("");
    stopPlayback();
    const recorder = new EdgeAudioRecorder();
    recorderRef.current = recorder;
    try {
      await recorder.start(setBars);
      setRecording(true);
      setSecondsLeft(CAPTURE_SECONDS);
      const started = Date.now();
      startedAtRef.current = started;
      window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        const left = Math.max(
          0,
          CAPTURE_SECONDS - Math.floor((Date.now() - started) / 1000),
        );
        setSecondsLeft(left);
        if (left === 0) {
          window.clearInterval(timerRef.current);
          void finish();
        }
      }, 200);
      setAnnounce("Recording started. It stops automatically after 5 seconds.");
    } catch (cause) {
      recorder.cancel();
      setRecording(false);
      onError(describeMicrophoneError(cause));
      setAnnounce("The microphone could not start.");
    } finally {
      startingRef.current = false;
    }
  };

  const toggleRecord = () => {
    if (recording) {
      void finish();
      return;
    }
    void start();
  };

  const togglePlay = () => {
    if (!capture) return;
    if (!audioRef.current) audioRef.current = new Audio(capture.objectUrl);
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    audio.src = capture.objectUrl;
    audio.onended = () => setPlaying(false);
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        onError("This device could not play the recording back.");
      });
  };

  const retry = () => {
    window.clearInterval(timerRef.current);
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
    setSecondsLeft(CAPTURE_SECONDS);
    stopPlayback();
    setDuration(null);
    setAnnounce("Recording cleared. Record again when ready.");
    onRetake();
  };

  const liveWaves = recording
    ? bars
    : capture
      ? capture.frequencyChartData.fftBins
      : bars;

  const elapsed = CAPTURE_SECONDS - secondsLeft;
  const durationLabel = recording
    ? mmss(elapsed)
    : duration !== null
      ? mmss(duration)
      : capture
        ? "saved"
        : mmss(0);

  return (
    <article className="nv-capture" aria-labelledby={`nv-${channel}-title`}>
      <div className="nv-capture__head">
        <span
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--nv-r-sm)] bg-[var(--nv-sage)] text-[var(--nv-forest)]"
        >
          <Icon className="h-6 w-6" strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`nv-${channel}-title`} className="nv-capture__title">
            {title}
          </h2>
          <p className="nv-capture__hint">{hint}</p>
        </div>
      </div>

      <div
        className="nv-wave"
        role="img"
        aria-label={
          recording
            ? `Live microphone waveform, ${elapsed} of ${CAPTURE_SECONDS} seconds`
            : capture
              ? duration !== null
                ? `Captured waveform, ${duration} seconds`
                : "Captured waveform"
              : "No recording yet"
        }
      >
        {liveWaves.map((value, index) => (
          <span
            key={index}
            className={`nv-wave__bar ${
              index >= 24 ? "max-[359px]:hidden" : ""
            }`}
            aria-hidden
            style={{ height: `${Math.max(8, Math.round(value * 100))}%` }}
          />
        ))}
        <span className="nv-duration" aria-hidden>
          {durationLabel}
        </span>
      </div>

      <div className="nv-capture__actions">
        <button
          type="button"
          className={`nv-rec ${recording ? "nv-rec--live" : ""}`}
          aria-label={
            recording
              ? `Stop ${title.toLowerCase()}`
              : capture
                ? `Record ${title.toLowerCase()} again`
                : `Record ${title.toLowerCase()}`
          }
          onClick={toggleRecord}
        >
          <span
            aria-hidden
            className={`inline-block h-4 w-4 shrink-0 rounded-full ${
              recording ? "bg-[#fff]" : "bg-[var(--nv-danger)]"
            }`}
          />
          <span className="nv-rec__timer">
            {recording ? `${secondsLeft}s` : "Record"}
          </span>
        </button>

        <button
          type="button"
          className="nv-btn nv-btn--ghost"
          onClick={togglePlay}
          disabled={!capture || recording}
          aria-label={playing ? "Pause recording" : "Play recording"}
        >
          {playing ? (
            <Pause aria-hidden className="h-4 w-4" />
          ) : (
            <Play aria-hidden className="h-4 w-4" />
          )}
          <span>Play</span>
        </button>

        <button
          type="button"
          className="nv-btn nv-btn--ghost"
          onClick={retry}
          disabled={!capture || recording}
          aria-label="Retake recording"
        >
          <RotateCcw aria-hidden className="h-4 w-4" />
          <span>Retry</span>
        </button>
      </div>

      <p className="nv-hint">
        {capture && !recording
          ? `Saved ${formatOpusKb(capture.compressedAudioBytes)} Opus into memory — tap Play to check, Retry to redo.`
          : caption}
      </p>
      <p className="nv-sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </article>
  );
}
