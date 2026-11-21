/**
 * Status derivation for the nurse "Patients & Reviews" surface.
 *
 * OWNER: Agent 3. Pure helpers only — no React, no Convex, no CSS imports, so
 * the rules stay unit-testable and cannot quietly drift from CONTRACT.md §6.
 *
 * Truth order (contract §6, nothing else is invented):
 *   1. no screening at all       -> "No screening yet"   (never "draft")
 *   2. reviewStatus "reviewed"   -> "Reviewed"
 *   3. reviewStatus "physical_referral" OR physicalReferralFlag -> "Referral"
 *   4. anything else             -> "Awaiting review"
 *
 * `medicationApproved` is intentionally NOT a row status: the schema only has
 * the three `reviewStatus` values above, and the specialist mutation writes
 * "reviewed" / "physical_referral". Using the flag as a fourth status would
 * invent a review outcome the backend never stores.
 */
import type { ReviewStatus } from "../lib/clinical";

/** `.nv-badge--*` modifiers implemented by src/nurse/nurse.css (Agent 1). */
export type PatientStatusTone = "neutral" | "pending" | "reviewed" | "referral";

export type PatientStatusLabel =
  | "No screening yet"
  | "Awaiting review"
  | "Reviewed"
  | "Referral";

export interface PatientStatus {
  label: PatientStatusLabel;
  tone: PatientStatusTone;
  /** Ready-to-apply className pair, e.g. "nv-badge nv-badge--pending". */
  badgeClass: string;
}

/** The only screening fields a status may be derived from. */
export interface ScreeningStatusInput {
  reviewStatus?: ReviewStatus | null;
  physicalReferralFlag?: boolean | null;
  medicationApproved?: boolean | null;
}

const BADGE_CLASS: Record<PatientStatusTone, string> = {
  neutral: "nv-badge nv-badge--neutral",
  pending: "nv-badge nv-badge--pending",
  reviewed: "nv-badge nv-badge--reviewed",
  referral: "nv-badge nv-badge--referral",
};

function status(label: PatientStatusLabel, tone: PatientStatusTone): PatientStatus {
  return { label, tone, badgeClass: BADGE_CLASS[tone] };
}

/**
 * Map one patient's latest screening (or `null` when the patient has none in
 * the loaded queue) to the status shown on their row.
 *
 * `null` and `undefined` both mean "no screening was found" — a patient with no
 * screening is never called a draft or submitted entry.
 */
export function derivePatientStatus(
  screening: ScreeningStatusInput | null | undefined,
): PatientStatus {
  if (screening == null) {
    return status("No screening yet", "neutral");
  }
  const reviewStatus = screening.reviewStatus ?? null;
  if (reviewStatus === "reviewed") {
    return status("Reviewed", "reviewed");
  }
  if (reviewStatus === "physical_referral" || screening.physicalReferralFlag === true) {
    return status("Referral", "referral");
  }
  return status("Awaiting review", "pending");
}

/**
 * Convex document timestamp -> "14 Jan 2025" (reference image format).
 * Deterministic locale so the label never flips with the host locale.
 */
export function formatEntryDate(timestamp?: number | null): string {
  if (timestamp == null || !Number.isFinite(timestamp)) return "—";
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "68y" / "age not recorded" — never a guessed age. */
export function formatAge(age?: number | null): string {
  if (age == null || !Number.isFinite(age)) return "age not recorded";
  return `${age}y`;
}

/** The roster only stores M / F / O. */
export function sexLabel(sex?: "M" | "F" | "O" | null): string {
  if (sex === "M") return "M";
  if (sex === "F") return "F";
  if (sex === "O") return "Other";
  return "Sex not recorded";
}
