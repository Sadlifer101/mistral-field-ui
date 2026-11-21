/**
 * Mistral Field — Patient / Vitals / Audio step rail.
 *
 * Three circular nodes joined by hairline connectors, matching reference images
 * 2 and 3: the node you are on is filled forest with its own glyph and a bold
 * label; completed nodes are filled forest with a check; upcoming nodes are
 * outlined paper.
 *
 * The mapping is deliberate and comes straight from the contract: the intake
 * flow has two live steps (`EntryStep` 1 = patient + vitals, 2 = audio) but the
 * rail shows three labels, so step 1 lights "Patient", step 2 completes
 * "Patient" and "Vitals" and lights "Audio", and step 3 completes all three.
 *
 * Styling: `.nv-steps` / `.nv-step*` in nurse.css.
 */
import { Activity, Check, Mic, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { STEP_LABELS, type EntryStep, type NurseStepRailProps } from "./contract";

const GLYPHS: readonly LucideIcon[] = [UserRound, Activity, Mic];

/** Which rail node is "current" for a given flow step (-1 = all complete). */
const CURRENT_NODE: Record<EntryStep, number> = { 1: 0, 2: 2, 3: -1 };

export function NurseStepRail({ current }: NurseStepRailProps) {
  const currentIndex = CURRENT_NODE[current];
  const allDone = current === 3;

  return (
    <ol className="nv-steps" role="list" aria-label="Screening progress">
      {STEP_LABELS.map((label, index) => {
        const isCurrent = index === currentIndex;
        const done = allDone || index < currentIndex;
        const Glyph = GLYPHS[index];
        const stepClass = ["nv-step", isCurrent ? "nv-step--current" : "", done ? "nv-step--done" : ""]
          .filter(Boolean)
          .join(" ");

        return (
          <li
            key={label}
            className={stepClass}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className="nv-step__dot" aria-hidden="true">
              {done ? (
                <Check size={20} strokeWidth={2.8} />
              ) : (
                <Glyph size={20} strokeWidth={1.9} />
              )}
            </span>
            <span className="nv-step__label">{label}</span>
            {index < STEP_LABELS.length - 1 ? (
              /* The connector after this node is "done" exactly when the node
                 itself is behind the current one. */
              <span
                className={done ? "nv-step__line nv-step__line--done" : "nv-step__line"}
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
