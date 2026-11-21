/**
 * Mistral Field — nurse surface shared contract.
 *
 * OWNER: lead agent. No implementation agent may edit this file.
 *
 * This module is types + constants only (no runtime imports beyond `import type`)
 * so that every screen module can be written in parallel against a frozen API.
 * The orchestrator (`src/components/MobileNurseApp.tsx`) is the only place that
 * owns business logic, Convex mutations and cross-step state.
 */
import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@convex/dataModel";
import type { api } from "@convex/api";
import type { CaptureResult } from "../utils/edgeAudioRecorder";
import type { ClinicalEngineResult } from "../utils/clinicalAcousticEngine";

/* ---------------------------------------------------------------- data types */

/** One row of the existing specialist queue query (screening + patient). */
export type QueueRow = FunctionReturnType<
  typeof api.triageLogbook.getSpecialistTriageQueue
>[number];

export type PatientId = Id<"patients">;
export type Sex = "M" | "F" | "O";
export type IntakeMode = "new" | "existing";
export type AudioChannel = "cough" | "phonation";

/** Top level routes of the nurse app. */
export type NurseFlow = "home" | "entry" | "patients";

/** 1 = patient details + vitals, 2 = audio capture, 3 = submitted report. */
export type EntryStep = 1 | 2 | 3;

/** Real connection state, derived by the orchestrator from Convex + navigator. */
export type ConnectionState = "connecting" | "live" | "offline";

export const STEP_LABELS = ["Patient", "Vitals", "Audio"] as const;

/* ------------------------------------------------------------------- intake */

/**
 * Every field the backend actually accepts for a nurse screening.
 * `phone` is optional in the Convex validator; everything else mirrors the
 * pre-existing form. No field here may become a new *required* backend arg.
 */
export interface IntakeValues {
  intakeMode: IntakeMode;
  fullName: string;
  age: string;
  sex: Sex;
  village: string;
  phone: string;
  spo2: string;
  respiratoryRate: string;
  temperatureC: string;
  symptomNotes: string;
  existingPatientId: PatientId | null;
}

/* ------------------------------------------------------------ screen contracts */

export interface NurseHomeScreenProps {
  nurseName: string;
  connection: ConnectionState;
  /** True when an entry is already in progress and would be resumed. */
  inProgress: boolean;
  onNewEntry: () => void;
  onPatients: () => void;
}

export interface NewEntryScreenProps {
  values: IntakeValues;
  onChange: <K extends keyof IntakeValues>(key: K, value: IntakeValues[K]) => void;
  /** Same predicate the orchestrator uses to allow "Continue to audio". */
  ready: boolean;
  onContinue: () => void;
  onCancel: () => void;
  connection: ConnectionState;
}

export interface AudioCaptureScreenProps {
  cough: CaptureResult | null;
  phonation: CaptureResult | null;
  onCapture: (channel: AudioChannel, result: CaptureResult) => void;
  onRetake: (channel: AudioChannel) => void;
  /** Microphone/permission failures surfaced by the orchestrator. */
  onError: (message: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}

export interface ScreeningReportScreenProps {
  report: ClinicalEngineResult;
  patientLabel: string;
  attachNotice: string | null;
  onAttach: (file: File) => void;
  onFinish: () => void;
}

export interface PatientsReviewsScreenProps {
  onBack: () => void;
  onStartScreening: () => void;
}

export interface NurseShellProps {
  children: ReactNode;
  flow: NurseFlow;
  nurseName: string;
  connection: ConnectionState;
  onHome: () => void;
  onSignOut: () => void;
  /** Only the orchestrator decides; the backdrop may still downgrade itself. */
  animateBackdrop: boolean;
}

export interface NurseStepRailProps {
  /** 1..3. `3` renders all three nodes as complete. */
  current: EntryStep;
}

export interface MeadowBackdropProps {
  variant: "animated" | "static";
}
