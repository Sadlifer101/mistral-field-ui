/**
 * Mistral Field — meadow backdrop.
 *
 * A fixed, non-interactive painting behind the whole nurse app: the lead's
 * poster always, the 8 s film only when it is safe to play it. Failure of any
 * kind leaves the poster in place and never touches the UI.
 *
 * Adapted from UI Forge `atelier-vale/cinematic-hero`:
 *  - `packages/boilerplates/atelier-vale-hero/src/components/FilmFrame.tsx`
 *    -> poster underneath, live film layered above, three-state load model
 *       (`loading | ready | error`), reveal only once the film can play,
 *       and an `onError` that falls back silently instead of blocking.
 *  - `packages/boilerplates/atelier-vale-hero/src/hooks/useHeroLoop.ts`
 *    -> mute/loop/playsInline hardened on the element itself, play on
 *       `canplay`, `play()` rejection swallowed (poster keeps the frame),
 *       cleanup removes listeners and pauses.
 *  - `packages/boilerplates/atelier-vale-hero/src/media.ts`
 *    -> one asset map as the source of truth. Here the files live in the Vite
 *       public root (`public/media`), owned by the lead, so `/media/...` is the
 *       correct address rather than an `import.meta.url` asset.
 *
 * The styling (and therefore all motion) lives in `nurse.css`
 * (`.nv-backdrop`, `.nv-backdrop__video`, `.nv-backdrop__veil`), which also
 * neutralises the film under `prefers-reduced-motion`.
 */
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { MeadowBackdropProps } from "./contract";

export const MEADOW_MEDIA = {
  poster: "/media/meadow-poster.jpg",
  video: "/media/meadow-8s.mp4",
} as const;

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
};

function connectionOf(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

/**
 * Data-saver / 2G networks must not spend 451 KB on decoration. Unknown or
 * unsupported Network Information API = allow (desktop browsers report none).
 */
function networkAllowsVideo(): boolean {
  const connection = connectionOf();
  if (!connection) return true;
  if (connection.saveData) return false;
  return connection.effectiveType !== "2g" && connection.effectiveType !== "slow-2g";
}

function useBackdropFilmAllowed(animated: boolean): boolean {
  const reducedMotion = useReducedMotion() === true;
  const [networkOk, setNetworkOk] = useState<boolean>(networkAllowsVideo);

  useEffect(() => {
    const connection = connectionOf();
    if (!connection?.addEventListener) return;
    const update = () => setNetworkOk(networkAllowsVideo());
    connection.addEventListener("change", update);
    return () => connection.removeEventListener?.("change", update);
  }, []);

  return animated && !reducedMotion && networkOk;
}

export function MeadowBackdrop({ variant }: MeadowBackdropProps) {
  const animated = variant === "animated";
  const filmAllowed = useBackdropFilmAllowed(animated);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!filmAllowed) {
      setReady(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Belt and braces on the element, mirroring useHeroLoop: some browsers
    // ignore the React attributes for autoplay policy purposes.
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.disablePictureInPicture = true;

    const play = () => {
      void video.play().catch(() => {
        /* Autoplay refused: the poster underneath stays as the visible frame. */
      });
    };

    video.addEventListener("canplay", play);

    // `preload="none"` in the markup, so the fetch is an explicit decision made
    // only after motion + network checks have passed. `load()` starts it.
    video.load();
    if (video.readyState >= 3) play();

    return () => {
      video.removeEventListener("canplay", play);
      video.pause();
    };
  }, [filmAllowed]);

  return (
    <div
      className="nv-backdrop"
      aria-hidden="true"
      style={{ backgroundImage: `url(${MEADOW_MEDIA.poster})` }}
    >
      {filmAllowed && !failed ? (
        <video
          ref={videoRef}
          className="nv-backdrop__video"
          data-ready={ready ? "true" : "false"}
          src={MEADOW_MEDIA.video}
          poster={MEADOW_MEDIA.poster}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          tabIndex={-1}
          onCanPlay={() => setReady(true)}
          onError={() => {
            setFailed(true);
            setReady(false);
          }}
        />
      ) : null}
      <div className="nv-backdrop__veil" />
    </div>
  );
}
