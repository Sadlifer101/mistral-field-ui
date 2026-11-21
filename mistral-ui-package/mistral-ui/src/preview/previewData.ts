/**
 * Synthetic fixtures for the development-only preview mode.
 *
 * Pure data: no Convex client, no network, no backend access.
 * Derived from the existing demo fixture file so the preview reuses
 * realistic patient records instead of inventing a second data set.
 *
 * The first five rows are aligned with the approved reference dashboard
 * (P-1047 … P-1043) so the preview can be compared against it case for case.
 * Nothing here reaches the real app: `convex/react` is aliased to a shim only
 * in `--mode preview`.
 */
import {
  INITIAL_TRIAGE_PATIENTS,
  type PatientDocument,
  type ScreeningVisit,
  type TriagePatient,
} from "../data/mockTriageData";

/** Backend review states (convex/lib clinical.ts) mapped from the demo fixture states. */
const REVIEW_CYCLE = ["pending_review", "reviewed", "physical_referral"] as const;

const PREVIEW_NOW = Date.now();

export interface PreviewPatientRow {
  _id: string;
  patientCode: string;
  fullName: string;
  age: number;
  sex: string;
  village: string;
  district: string;
  phcCenter: string;
}

export interface PreviewScreening {
  _id: string;
  _creationTime?: number;
  level1Status: string;
  riskScore: number;
  reviewStatus: string;
  compressedAudioBytes: number;
  physicalReferralFlag: boolean;
  medicationApproved: boolean;
  rawTranscript: string;
  translatedEnText?: string;
  symptomNotes?: string;
  spo2Percent?: number;
  respiratoryRate?: number;
  temperatureC?: number;
  specialistRemarks: string;
  referralInstructions: string;
  aiClinicalBrief: string;
  frequencyChartData: unknown;
  coughAudioUrl: string | null;
  speechAudioUrl: string | null;
  recordedAt: string;
}

export interface PreviewQueueItem {
  patient: PreviewPatientRow;
  screening: PreviewScreening;
}

export interface PreviewLogbookDocument {
  _id: string;
  docType: string;
  fileName: string;
  fileUrl: string | null;
  notes: string;
  uploadedAt: number;
}

export interface PreviewLogbook {
  patient: PreviewPatientRow;
  screenings: PreviewScreening[];
  documents: PreviewLogbookDocument[];
}

export const PREVIEW_SPECIALIST = {
  _id: "preview:staff:specialist",
  role: "city_specialist" as const,
  fullName: "Dr. A. Mehra",
  facilityName: "District Chest & Respiratory Clinic",
  district: "Satara",
};

export const PREVIEW_NURSE = {
  _id: "preview:staff:nurse",
  role: "nurse" as const,
  fullName: "Helena D'Souza",
  facilityName: "Rural PHC Field Unit",
  district: "Satara",
};

/**
 * Reference case rows: the five screenings the approved dashboard opens on.
 * `level` uses the backend's Level-1 vocabulary (urgent/monitor/normal); the UI
 * renders High/Medium/Low from it.
 */
interface ReferenceCase {
  code: string;
  sex: string;
  age: number;
  complaint: string;
  level: string;
  risk: number;
  minutesAgo: number;
  spo2: number;
  respRate: number;
  temp: number;
}

const REFERENCE_CASES: readonly ReferenceCase[] = [
  {
    code: "P-1047",
    sex: "F",
    age: 62,
    complaint: "Dyspnea, persistent cough",
    level: "urgent",
    risk: 86,
    minutesAgo: 8,
    spo2: 94,
    respRate: 24,
    temp: 37.8,
  },
  {
    code: "P-1046",
    sex: "M",
    age: 48,
    complaint: "Cough, wheeze",
    level: "monitor",
    risk: 54,
    minutesAgo: 12,
    spo2: 96,
    respRate: 21,
    temp: 37.4,
  },
  {
    code: "P-1045",
    sex: "F",
    age: 71,
    complaint: "Cough, low-grade fever",
    level: "monitor",
    risk: 47,
    minutesAgo: 16,
    spo2: 95,
    respRate: 20,
    temp: 37.9,
  },
  {
    code: "P-1044",
    sex: "M",
    age: 35,
    complaint: "Recurrent cough",
    level: "normal",
    risk: 22,
    minutesAgo: 18,
    spo2: 98,
    respRate: 17,
    temp: 36.8,
  },
  {
    code: "P-1043",
    sex: "M",
    age: 68,
    complaint: "Breathlessness, fatigue",
    level: "urgent",
    risk: 79,
    minutesAgo: 22,
    spo2: 91,
    respRate: 25,
    temp: 37.2,
  },
];

function toPatientRow(patient: TriagePatient): PreviewPatientRow {
  return {
    _id: patient._id,
    patientCode: patient.patientCode,
    fullName: patient.fullName,
    age: patient.age,
    sex: patient.sex,
    village: patient.village,
    district: patient.district,
    phcCenter: patient.phcCenter,
  };
}

// Short, clearly synthetic WAV fixtures for exercising the native audio controls in preview only.
function previewTone(frequency: number): string {
  const sampleRate = 8000;
  const size = sampleRate * 4;
  const bytes = new Uint8Array(44 + size);
  const header = new DataView(bytes.buffer);
  bytes.set([82, 73, 70, 70], 0); // RIFF
  header.setUint32(4, 36 + size, true);
  bytes.set([87, 65, 86, 69, 102, 109, 116, 32], 8); // WAVE / fmt
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate, true);
  header.setUint16(32, 1, true);
  header.setUint16(34, 8, true);
  bytes.set([100, 97, 116, 97], 36); // data
  header.setUint32(40, size, true);
  for (let index = 0; index < size; index++) {
    const envelope = Math.sin(Math.PI * index / size) ** 2;
    bytes[44 + index] = 128 + Math.round(19 * envelope * Math.sin(2 * Math.PI * frequency * index / sampleRate));
  }
  return "data:audio/wav;base64," + btoa(String.fromCharCode(...bytes));
}
const PREVIEW_AUDIO = { cough: previewTone(196), voice: previewTone(262) };

function toPrimaryScreening(patient: TriagePatient, reviewStatus: string): PreviewScreening {
  return {
    _id: `${patient._id}:screening:current`,
    _creationTime: PREVIEW_NOW - 8 * 60_000,
    level1Status: patient.level1Status,
    riskScore: patient.riskScore,
    reviewStatus,
    compressedAudioBytes: patient.compressedAudioBytes,
    physicalReferralFlag: patient.physicalReferralFlag,
    medicationApproved: reviewStatus === "reviewed",
    rawTranscript: patient.rawTranscript,
    translatedEnText: patient.translatedEnText,
    symptomNotes: patient.translatedEnText,
    spo2Percent: patient.spo2Percent,
    respiratoryRate: patient.respRateBpm,
    temperatureC: patient.tempCelsius,
    specialistRemarks: patient.specialistRemarks,
    referralInstructions: patient.referralInstructions,
    aiClinicalBrief: patient.aiClinicalBrief,
    frequencyChartData: patient.frequencyChartData,
    // Audio playback needs a real stored file; the preview shows the "not stored" state.
    coughAudioUrl: null,
    speechAudioUrl: null,
    recordedAt: patient.recordedAt,
  };
}

/** Rewrites the first five demo rows into the reference case set. */
function alignWithReference(
  patient: TriagePatient,
  screening: PreviewScreening,
  reference: ReferenceCase,
): { patient: PreviewPatientRow; screening: PreviewScreening } {
  return {
    patient: {
      ...toPatientRow(patient),
      patientCode: reference.code,
      sex: reference.sex,
      age: reference.age,
    },
    screening: {
      ...screening,
      _creationTime: PREVIEW_NOW - reference.minutesAgo * 60_000,
      level1Status: reference.level,
      riskScore: reference.risk,
      symptomNotes: reference.complaint,
      translatedEnText: reference.complaint,
      spo2Percent: reference.spo2,
      respiratoryRate: reference.respRate,
      temperatureC: reference.temp,
      ...(reference.code === "P-1047" ? { coughAudioUrl: PREVIEW_AUDIO.cough, speechAudioUrl: PREVIEW_AUDIO.voice } : {}),
    },
  };
}

function toHistoryScreening(
  patient: TriagePatient,
  visit: ScreeningVisit,
  index: number,
): PreviewScreening {
  return {
    _id: `${patient._id}:screening:${index + 1}`,
    _creationTime: Date.parse(visit.date),
    level1Status: visit.level1Status,
    riskScore: visit.riskScore,
    reviewStatus: "reviewed",
    compressedAudioBytes: patient.compressedAudioBytes,
    physicalReferralFlag: false,
    medicationApproved: true,
    rawTranscript: "",
    specialistRemarks: visit.notes,
    referralInstructions: "",
    aiClinicalBrief: `${visit.symptomDrift}. ${visit.notes}`,
    frequencyChartData: patient.frequencyChartData,
    coughAudioUrl: null,
    speechAudioUrl: null,
    recordedAt: visit.date,
  };
}

function toDocument(
  patient: TriagePatient,
  document: PatientDocument,
  index: number,
): PreviewLogbookDocument {
  return {
    _id: `${patient._id}:doc:${index + 1}`,
    docType: document.type,
    fileName: document.title,
    fileUrl: null,
    notes: document.summary,
    uploadedAt: Date.parse(document.date),
  };
}

/** One queue row per demo patient, with review states spread across the directory tabs. */
export const PREVIEW_QUEUE: PreviewQueueItem[] = INITIAL_TRIAGE_PATIENTS.slice(0, 5).map((patient, index) => {
  const reference = REFERENCE_CASES[index];
  const screening = toPrimaryScreening(patient, REVIEW_CYCLE[index % REVIEW_CYCLE.length] ?? "pending_review");
  if (!reference) return { patient: toPatientRow(patient), screening };
  return alignWithReference(patient, screening, reference);
});

export const PREVIEW_LOGBOOKS: Record<string, PreviewLogbook> = Object.fromEntries(
  INITIAL_TRIAGE_PATIENTS.map((patient, index) => {
    const reference = REFERENCE_CASES[index];
    const primary = toPrimaryScreening(
      patient,
      REVIEW_CYCLE[index % REVIEW_CYCLE.length] ?? "pending_review",
    );
    const aligned = reference
      ? alignWithReference(patient, primary, reference)
      : { patient: toPatientRow(patient), screening: primary };

    return [
      patient._id,
      {
        patient: aligned.patient,
        screenings: [
          aligned.screening,
          ...patient.previousScreenings.map((visit, visitIndex) =>
            toHistoryScreening(patient, visit, visitIndex),
          ),
        ],
        documents: patient.patientDocuments.map((document, documentIndex) =>
          toDocument(patient, document, documentIndex),
        ),
      },
    ];
  }),
);

export const PREVIEW_PATIENTS: PreviewPatientRow[] = INITIAL_TRIAGE_PATIENTS.map(
  (patient, index) => {
    const reference = REFERENCE_CASES[index];
    if (!reference) return toPatientRow(patient);
    return alignWithReference(patient, toPrimaryScreening(patient, "pending_review"), reference)
      .patient;
  },
);

export function getPreviewLogbook(patientId: string): PreviewLogbook | null {
  return PREVIEW_LOGBOOKS[patientId] ?? null;
}
