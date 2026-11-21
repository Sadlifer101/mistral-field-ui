/**
 * Mistral Field — nurse home.
 *
 * Exactly two boxes, as in reference image 1: full-width forest cards on the
 * meadow, each an icon square, a hairline rule, then title + two-line
 * description. No analytics, no grid, no nav list, no third tile.
 *
 * Motion: one entrance (staggered rise/fade) plus a gentle press. Nothing
 * continuous — the meadow film is the only ambient movement in the app.
 *
 * Choreography adapted from UI Forge `editorial-stagger`
 * (`packages/motion/editorial-stagger/index.tsx`): a parent variants object
 * carries `staggerChildren`, children own the rise/opacity, and a settled
 * reduced-motion user gets the final state immediately
 * (`initial={settled ? false : "hidden"}`) with zero-duration children. The
 * `[0.16, 1, 0.3, 1]` easing is the same one `atelier-vale/.../Reveal.tsx` and
 * `nurse.css` (`--nv-ease`) use.
 */
import { motion, useReducedMotion, type Variants } from "motion/react";
import { ClipboardPlus, NotebookPen } from "lucide-react";
import type { NurseHomeScreenProps } from "./contract";

const NV_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function NurseHomeScreen({ inProgress, onNewEntry, onPatients }: NurseHomeScreenProps) {
  const settled = useReducedMotion() === true;

  const listVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: settled ? 0 : 0.07,
        delayChildren: settled ? 0 : 0.04,
      },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: settled ? 0 : 0.52, ease: NV_EASE },
    },
  };

  const press = settled
    ? undefined
    : { scale: 0.986, transition: { duration: 0.12, ease: NV_EASE } };

  return (
    <motion.section
      className="nv-home"
      aria-labelledby="nv-home-title"
      variants={listVariants}
      initial={settled ? false : "hidden"}
      animate="visible"
    >
      <h1 id="nv-home-title" className="nv-sr-only">
        Nurse home
      </h1>

      {inProgress ? (
        <p className="nv-notice">
          <NotebookPen size={15} strokeWidth={1.9} aria-hidden="true" />
          <span>Entry in progress — tap New Entry to resume</span>
        </p>
      ) : null}

      <motion.button
        type="button"
        className="nv-home-card"
        variants={cardVariants}
        whileTap={press}
        onClick={onNewEntry}
      >
        <span className="nv-home-card__icon" aria-hidden="true">
          <ClipboardPlus size={27} strokeWidth={1.6} />
        </span>
        <span className="nv-home-card__rule" aria-hidden="true" />
        <span className="nv-home-card__body">
          <span className="nv-home-card__title">New Entry</span>
          <span className="nv-home-card__desc">
            Register patient, record vitals, capture audio
          </span>
        </span>
      </motion.button>

      <motion.button
        type="button"
        className="nv-home-card"
        variants={cardVariants}
        whileTap={press}
        onClick={onPatients}
      >
        <span className="nv-home-card__icon" aria-hidden="true">
          <PatientsGlyph />
        </span>
        <span className="nv-home-card__rule" aria-hidden="true" />
        <span className="nv-home-card__body">
          <span className="nv-home-card__title">Patients &amp; Reviews</span>
          <span className="nv-home-card__desc">
            Open saved entries and check doctor feedback
          </span>
        </span>
      </motion.button>
    </motion.section>
  );
}

/**
 * Folder-with-person mark for "Patients & Reviews" (reference image 1).
 * Drawn inline because this lucide version has no folder+person glyph; stroke
 * weight matches the 1.6px lucide marks next to it.
 */
function PatientsGlyph() {
  return (
    <svg
      width={27}
      height={27}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.4 9.6c0-1.1.9-2 2-2h5.7l2 2.2h9.5c1.1 0 2 .9 2 2v9.1c0 1.1-.9 2-2 2H5.4c-1.1 0-2-.9-2-2V9.6Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="14.4" r="2.15" stroke="currentColor" strokeWidth={1.6} />
      <path
        d="M10.4 20.4c.5-1.9 1.9-3 3.6-3s3.1 1.1 3.6 3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
