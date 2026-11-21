import { usePresence } from "motion/react";
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

export function SpecialistDialog({ titleId, onClose, busy = false, className, style, children }: {
  titleId: string;
  onClose: () => void;
  busy?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [isPresent, safeToRemove] = usePresence();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = oldOverflow;
    };
  }, []);

  useLayoutEffect(() => {
    if (isPresent) return;
    // Like Forge's Therma dialog, retain modal ownership until its exit finishes.
    const animations = dialogRef.current?.getAnimations() ?? [];
    if (!animations.length) {
      safeToRemove?.();
      return;
    }
    let cancelled = false;
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (!cancelled) safeToRemove?.();
    });
    return () => { cancelled = true; };
  }, [isPresent, safeToRemove]);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} data-state={isPresent ? "open" : "closing"} className={`sp-dialog ${className ?? ""}`} style={style}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy && isPresent) onClose();
      }}
      onClick={(event) => {
        if (busy || !isPresent || event.target !== event.currentTarget) return;
        const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
        if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) onClose();
      }}>
      <div inert={!isPresent}>{children}</div>
    </dialog>
  );
}
