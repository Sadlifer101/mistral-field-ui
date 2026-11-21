import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { Gauge, Pause, Play } from "lucide-react";
import type { AcousticChannelType } from "../lib/clinical";
import { sampleFromAudioBuffer } from "../utils/audioSynthesizer";
import { SpecialistSelect } from "./SpecialistSelect";

type Channel = AcousticChannelType;
type Track = { duration: number; offset: number; peaks: number[]; error?: boolean };
export type AcousticPlayback = {
  isPlaying: boolean;
  hasPlayback: boolean;
  progress: number;
  channel: Channel;
};
const INITIAL_TRACK: Track = { duration: 0, offset: 0, peaks: [] };
const CHANNELS = [{ key: "cough", label: "Cough" }, { key: "phonation", label: "Voice" }] as const;
const RATES = [
  { value: "0.75", label: "0.75×" },
  { value: "1", label: "1×" },
  { value: "1.25", label: "1.25×" },
  { value: "1.5", label: "1.5×" },
] as const;

function clock(seconds: number) {
  const sec = Math.max(0, Math.floor(seconds));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function waveformBars(peaks: number[]) {
  const count = Math.min(peaks.length, 48);
  return Array.from({ length: count }, (_, bin) => {
    const first = Math.floor(bin * peaks.length / count);
    const last = Math.floor((bin + 1) * peaks.length / count);
    return Math.max(...peaks.slice(first, last));
  });
}

// Restores the original waveform's full-track hit area, capture and 5% keyboard steps.
function WaveformScrubber({ label, track, onSeek }: {
  label: string;
  track: Track;
  onSeek: (progress: number) => void;
}) {
  const drag = useRef<number | null>(null);
  const progress = Math.min(1, track.offset / track.duration);
  function seekPointer(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width) onSeek((event.clientX - box.left) / box.width);
  }

  return (
    <div role="slider" tabIndex={0} className="sp-wave" aria-label={`Scrub ${label} audio`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
      aria-valuetext={`${track.offset.toFixed(1)} of ${track.duration.toFixed(1)} seconds`}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = event.pointerId;
        seekPointer(event);
      }}
      onPointerMove={(event) => { if (drag.current === event.pointerId) seekPointer(event); }}
      onPointerUp={(event) => {
        if (drag.current !== event.pointerId) return;
        seekPointer(event);
        drag.current = null;
      }}
      onLostPointerCapture={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={(event) => {
        const current = track.offset / track.duration;
        const next = event.key === "Home" ? 0 : event.key === "End" ? 1
          : event.key === "ArrowRight" || event.key === "ArrowUp" ? current + 0.05
          : event.key === "ArrowLeft" || event.key === "ArrowDown" ? current - 0.05 : null;
        if (next === null) return;
        event.preventDefault();
        onSeek(next);
      }}>
      {track.peaks.length ? (
        <div className="sp-wave-bars" aria-hidden="true">
          {track.peaks.map((peak, index) => (
            <span key={index} data-played={(index + 0.5) / track.peaks.length <= progress}
              style={{ height: `${Math.max(10, peak * 100)}%` }} />
          ))}
        </div>
      ) : <span className="sp-wave-baseline" aria-hidden="true" />}
      <span className="sp-wave-needle" aria-hidden="true" style={{ insetInlineStart: `clamp(0px, ${progress * 100}%, calc(100% - 2px))` }} />
    </div>
  );
}

export function AcousticSamplePlayer({ coughAudioUrl, speechAudioUrl, theme = "dark", activeChannel, onPlaybackSync }: {
  coughAudioUrl: string | null;
  speechAudioUrl: string | null;
  theme?: "light" | "dark";
  activeChannel: Channel;
  onPlaybackSync: (playback: AcousticPlayback) => void;
}) {
  const [tracks, setTracks] = useState<Record<Channel, Track>>({ cough: INITIAL_TRACK, phonation: INITIAL_TRACK });
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [rate, setRate] = useState<(typeof RATES)[number]["value"]>("1");
  const media = useRef<Partial<Record<Channel, HTMLAudioElement | null>>>({});
  const selected = useRef<Channel>("cough");
  const playingRef = useRef<Channel | null>(null);
  const requestedPlayback = useRef<Channel | null>(null);
  const lastPlayback = useRef<AcousticPlayback | null>(null);

  const update = useCallback((channel: Channel, values: Partial<Track>) => {
    setTracks((old) => ({ ...old, [channel]: { ...old[channel], ...values } }));
  }, []);

  useLayoutEffect(() => {
    const elements = Object.values(media.current);
    return () => elements.forEach((element) => element?.pause());
  }, [coughAudioUrl, speechAudioUrl]);

  useEffect(() => {
    update("cough", { peaks: [] });
    update("phonation", { peaks: [] });
    const Context = window.OfflineAudioContext || (window as Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!Context || (!coughAudioUrl && !speechAudioUrl)) return;
    const context = new Context(1, 1, 22050);
    const abort = new AbortController();
    for (const { key } of CHANNELS) {
      const url = key === "cough" ? coughAudioUrl : speechAudioUrl;
      if (!url) continue;
      void (async () => {
        try {
          const response = await fetch(url, { signal: abort.signal });
          if (!response.ok) return;
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          if (!abort.signal.aborted) update(key, { peaks: waveformBars(sampleFromAudioBuffer(buffer).waveformPeaks) });
        } catch {
          // Media can remain playable when waveform decoding is unavailable.
        }
      })();
    }
    return () => abort.abort();
  }, [coughAudioUrl, speechAudioUrl, update]);

  const publish = useCallback(() => {
    const channel = selected.current;
    const audio = media.current[channel];
    const duration = audio?.duration ?? 0;
    const next = {
      channel,
      progress: audio && Number.isFinite(duration) && duration > 0 ? audio.currentTime / duration : 0,
      isPlaying: playingRef.current === channel,
      hasPlayback: playingRef.current !== null,
    };
    const previous = lastPlayback.current;
    if (previous?.channel === next.channel && previous.progress === next.progress &&
      previous.isPlaying === next.isPlaying && previous.hasPlayback === next.hasPlayback) return;
    lastPlayback.current = next;
    onPlaybackSync(next);
  }, [onPlaybackSync]);

  const sync = useCallback((channel: Channel, audio: HTMLAudioElement) => {
    update(channel, { offset: audio.currentTime });
    publish();
  }, [publish, update]);

  useEffect(() => {
    if (!playing) return;
    let frame: number;
    let last = -Infinity;
    const tick = (now: number) => {
      const audio = media.current[playing];
      if (!audio || playingRef.current !== playing || audio.paused) return;
      if (now - last >= 25) {
        sync(playing, audio);
        last = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, sync]);

  function setTransport(channel: Channel | null) {
    playingRef.current = channel;
    setPlaying(channel);
    publish();
  }

  function selectChannel(channel: Channel) {
    selected.current = channel;
    publish();
  }

  async function toggle(channel: Channel) {
    const audio = media.current[channel];
    if (!audio) return;
    if (!audio.paused) {
      requestedPlayback.current = null;
      audio.pause();
      return;
    }
    requestedPlayback.current = channel;
    selectChannel(channel);
    for (const { key } of CHANNELS) if (key !== channel) media.current[key]?.pause();
    audio.playbackRate = Number(rate);
    try {
      await audio.play();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) update(channel, { error: true });
    }
  }

  function seek(channel: Channel, ratio: number) {
    const audio = media.current[channel];
    if (!audio || !Number.isFinite(audio.duration)) return;
    selected.current = channel;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
    sync(channel, audio);
  }

  return (
    <div className="sp-audio">
      {CHANNELS.map(({ key, label }) => {
        const url = key === "cough" ? coughAudioUrl : speechAudioUrl;
        const track = tracks[key];
        return (
          <div className="sp-audio-row" key={key} data-selected={activeChannel === key}>
            {url && <audio
              src={url} preload="metadata" ref={(node) => { media.current[key] = node; }}
              onLoadStart={() => update(key, { duration: 0, offset: 0, error: false })}
              onDurationChange={(event) => update(key, { duration: Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0 })}
              onSeeking={(event) => sync(key, event.currentTarget)}
              onTimeUpdate={(event) => sync(key, event.currentTarget)}
              onPlay={(event) => {
                if (requestedPlayback.current !== key) event.currentTarget.pause();
                else setTransport(key);
              }}
              onPause={(event) => {
                if (playingRef.current === key) setTransport(null);
                sync(key, event.currentTarget);
              }}
              onEnded={(event) => {
                event.currentTarget.currentTime = 0;
                if (playingRef.current === key) setTransport(null);
                sync(key, event.currentTarget);
              }}
              onError={() => {
                if (playingRef.current === key) setTransport(null);
                update(key, { error: true });
              }}
            />}
            <button type="button" className="sp-audio-play" disabled={!url || track.error} onClick={() => void toggle(key)}
              aria-label={`${playing === key ? "Pause" : "Play"} ${label}`}>
              {playing === key ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            </button>
            <button type="button" className="sp-audio-label" aria-pressed={activeChannel === key}
              aria-label={`Inspect ${label.toLowerCase()} recording`} disabled={!url || track.error}
              onClick={() => selectChannel(key)}>{label}</button>
            {url && track.duration > 0 && !track.error ? (
              <>
                <WaveformScrubber label={label} track={track} onSeek={(ratio) => seek(key, ratio)} />
                <span className="sp-audio-clock">{clock(track.offset)} / {clock(track.duration)}</span>
              </>
            ) : <p className="sp-audio-state">{url ? track.error ? "Recording unavailable" : "Loading audio…" : "No recording stored"}</p>}
          </div>
        );
      })}
      {(coughAudioUrl || speechAudioUrl) && <div className="sp-playback-rate">
        <span>Playback speed</span>
        <SpecialistSelect label="Playback speed" value={rate} options={RATES} theme={theme} Icon={Gauge}
          onChange={(next) => {
            setRate(next);
            for (const { key } of CHANNELS) {
              const audio = media.current[key];
              if (audio) audio.playbackRate = Number(next);
            }
          }} />
      </div>}
    </div>
  );
}
