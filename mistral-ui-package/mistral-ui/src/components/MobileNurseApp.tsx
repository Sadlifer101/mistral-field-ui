import { useEffect, useRef, useState } from "react";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import type { StaffProfile } from "../lib/clinical";
import type { CaptureResult } from "../utils/edgeAudioRecorder";
import {
  analyzeClinicalAcoustics,
  type ClinicalEngineResult,
} from "../utils/clinicalAcousticEngine";
import type {
  AudioChannel,
  ConnectionState,
  EntryStep,
  IntakeValues,
  NurseFlow,
} from "../nurse/contract";
import { NurseShell } from "../nurse/NurseShell";
import { NurseHomeScreen } from "../nurse/NurseHomeScreen";
import { NewEntryScreen } from "../nurse/NewEntryScreen";
import { AudioCaptureScreen } from "../nurse/AudioCaptureScreen";
import { ScreeningReportScreen } from "../nurse/ScreeningReportScreen";
import { PatientsReviewsScreen } from "../nurse/PatientsReviewsScreen";

interface MobileNurseAppProps {
  nurse: StaffProfile;
  onSignOut: () => void;
}

const EMPTY_INTAKE: IntakeValues = {
  intakeMode: "new",
  fullName: "",
  age: "",
  sex: "F",
  village: "",
  phone: "",
  spo2: "",
  respiratoryRate: "",
  temperatureC: "",
  symptomNotes: "",
  existingPatientId: null,
};

function detectPreferredLang(notes: string): "hi" | "en" | "mr" | "ta" | "te" | "bn" | "kn" {
  if (/[\u0C80-\u0CFF]/.test(notes)) return "kn";
  if (/[\u0900-\u097F]/.test(notes)) return /[\u0900-\u097F]/.test(notes) && /मराठी|आहे/.test(notes) ? "mr" : "hi";
  if (/[\u0B80-\u0BFF]/.test(notes)) return "ta";
  if (/[\u0C00-\u0C7F]/.test(notes)) return "te";
  if (/[\u0980-\u09FF]/.test(notes)) return "bn";
  return "en";
}

function isStoragePayload(value: unknown): value is { storageId: Id<"_storage"> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "storageId" in value &&
    typeof (value as { storageId?: unknown }).storageId === "string"
  );
}

async function uploadBlob(
  generateAudioUploadUrl: (args: Record<string, never>) => Promise<string>,
  capture: CaptureResult,
): Promise<Id<"_storage">> {
  const uploadUrl = await generateAudioUploadUrl({});
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": capture.mimeType || "audio/webm" },
    body: capture.blob,
  });
  if (!response.ok) throw new Error("Opus upload failed on the edge link.");
  const payload: unknown = await response.json();
  if (!isStoragePayload(payload)) throw new Error("Upload did not return a storage id.");
  return payload.storageId;
}

function numberOrNull(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

export function MobileNurseApp({ nurse, onSignOut }: MobileNurseAppProps) {
  const nurseProfile = useQuery(api.triageLogbook.getMyStaffProfile, { role: "nurse" });
  const upsertStaffProfile = useMutation(api.triageLogbook.upsertStaffProfile);
  const generateAudioUploadUrl = useMutation(api.triageLogbook.generateAudioUploadUrl);
  const createPatient = useMutation(api.triageLogbook.createLogbookPatient);
  const submitScreening = useMutation(api.triageLogbook.submitTriageScreening);
  const attachDocument = useMutation(api.triageLogbook.attachPatientDocument);
  const nurseName = nurseProfile?.fullName || nurse.fullName;

  useEffect(() => {
    if (nurseProfile === undefined || nurseProfile !== null) return;
    void upsertStaffProfile({
      role: "nurse",
      fullName: nurse.fullName || "helena",
      facilityName: "Rural PHC Field Unit",
      district: "Satara",
    });
  }, [nurse.fullName, nurseProfile, upsertStaffProfile]);

  /* -------------------------------------------------------------- navigation */
  const [flow, setFlow] = useState<NurseFlow>("home");
  const [step, setStep] = useState<EntryStep>(1);

  /* ----------------------------------------------------------- intake state --
     Held here (not inside the screens) so that walking back to the home screen,
     or into Patients & Reviews, never loses a half-finished entry or a recording. */
  const [intake, setIntake] = useState<IntakeValues>(EMPTY_INTAKE);
  const [cough, setCough] = useState<CaptureResult | null>(null);
  const [phonation, setPhonation] = useState<CaptureResult | null>(null);
  const [patientId, setPatientId] = useState<Id<"patients"> | null>(null);
  const [screeningId, setScreeningId] = useState<Id<"screenings"> | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [report, setReport] = useState<ClinicalEngineResult | null>(null);
  const [attachNotice, setAttachNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------------------------------- connection --
     Real state only: the Convex socket plus the browser's own online flag. */
  const convexConnection = useConvexConnectionState();
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  const connection: ConnectionState = !online
    ? "offline"
    : convexConnection.isWebSocketConnected
      ? "live"
      : "connecting";

  /* A new screen or step must open at its own top: swapping screens otherwise
     inherited the previous scroll offset and hid the heading and step rail. */
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [flow, step]);

  /* Held recordings are revoked on replace / retake / clear; this releases them
     when the whole surface unmounts (sign-out included) so no blob URL leaks. */
  const capturesRef = useRef<{ cough: CaptureResult | null; phonation: CaptureResult | null }>({
    cough: null,
    phonation: null,
  });
  useEffect(() => {
    capturesRef.current = { cough, phonation };
  }, [cough, phonation]);
  useEffect(
    () => () => {
      const held = capturesRef.current;
      if (held.cough?.objectUrl) URL.revokeObjectURL(held.cough.objectUrl);
      if (held.phonation?.objectUrl) URL.revokeObjectURL(held.phonation.objectUrl);
    },
    [],
  );

  const spo2Value = numberOrNull(intake.spo2);
  const rrValue = numberOrNull(intake.respiratoryRate);
  const tempValue = numberOrNull(intake.temperatureC);

  const intakeReady =
    intake.intakeMode === "existing"
      ? intake.existingPatientId !== null
      : intake.fullName.trim().length > 1 &&
        Number.isInteger(Number(intake.age)) &&
        Number(intake.age) >= 1 &&
        Number(intake.age) <= 120 &&
        intake.village.trim().length > 0;

  const inProgress =
    step !== 1 ||
    cough !== null ||
    phonation !== null ||
    report !== null ||
    intake.fullName.trim().length > 0 ||
    intake.village.trim().length > 0 ||
    intake.symptomNotes.trim().length > 0 ||
    intake.existingPatientId !== null;

  const updateIntake = <K extends keyof IntakeValues,>(key: K, value: IntakeValues[K]) => {
    setIntake((previous) => ({ ...previous, [key]: value }));
  };

  const releaseCapture = (capture: CaptureResult | null) => {
    if (capture?.objectUrl) URL.revokeObjectURL(capture.objectUrl);
  };

  const clearEntry = () => {
    releaseCapture(cough);
    releaseCapture(phonation);
    setCough(null);
    setPhonation(null);
    setIntake(EMPTY_INTAKE);
    setPatientId(null);
    setScreeningId(null);
    setDispatching(false);
    setReport(null);
    setAttachNotice(null);
    setError(null);
    setStep(1);
  };

  const startNewEntry = () => {
    if (!inProgress) clearEntry();
    setError(null);
    setFlow("entry");
  };

  const handleCapture = (channel: AudioChannel, result: CaptureResult) => {
    if (channel === "cough") {
      releaseCapture(cough);
      setCough(result);
    } else {
      releaseCapture(phonation);
      setPhonation(result);
    }
  };

  const handleRetake = (channel: AudioChannel) => {
    if (channel === "cough") {
      releaseCapture(cough);
      setCough(null);
    } else {
      releaseCapture(phonation);
      setPhonation(null);
    }
  };

  /* --------------------------------------------------------------- dispatch --
     Payload and ordering are unchanged from the previous implementation: patient
     creation, two parallel audio uploads, local acoustic analysis, then the
     screening mutation. Only the form that feeds it has been redesigned. */
  const handleDispatch = async () => {
    if (!cough || !phonation) return;
    setError(null);
    setDispatching(true);
    try {
      let nextPatientId = intake.existingPatientId;
      if (intake.intakeMode === "new" || nextPatientId === null) {
        const notes = [
          intake.symptomNotes.trim() || undefined,
          spo2Value !== null ? `SpO2 ${spo2Value}%` : undefined,
          rrValue !== null ? `RR ${rrValue}` : undefined,
          tempValue !== null ? `Temp ${tempValue}C` : undefined,
        ].filter((item): item is string => Boolean(item));
        const phone = intake.phone.trim();
        nextPatientId = await createPatient({
          fullName: intake.fullName.trim(),
          age: Number(intake.age),
          sex: intake.sex,
          village: intake.village.trim(),
          preferredLang: detectPreferredLang(intake.symptomNotes),
          smokingHistory: false,
          ...(phone ? { phone } : {}),
          ...(notes.length > 0 ? { chronicConditions: notes } : {}),
        });
      }
      const [coughId, speechId] = await Promise.all([
        uploadBlob(generateAudioUploadUrl, cough),
        uploadBlob(generateAudioUploadUrl, phonation),
      ]);
      const compressedAudioBytes = cough.compressedAudioBytes + phonation.compressedAudioBytes;
      const frequencyChartData = {
        fftBins: cough.frequencyChartData.fftBins,
        fundamentalFreqHz: phonation.frequencyChartData.fundamentalFreqHz,
        spectralCentroidHz: cough.frequencyChartData.spectralCentroidHz,
        zeroCrossingRate: cough.frequencyChartData.zeroCrossingRate,
        peakRmsEnergy: Math.max(
          cough.frequencyChartData.peakRmsEnergy,
          phonation.frequencyChartData.peakRmsEnergy,
        ),
      };
      const clinical = analyzeClinicalAcoustics({
        frequencyChartData,
        spO2: spo2Value,
        respiratoryRate: rrValue,
        temperatureC: tempValue,
        age: Number(intake.age) || null,
        symptomNotes: intake.symptomNotes,
      });
      setReport(clinical);
      setStep(3);
      const notes = intake.symptomNotes.trim();
      const id = await submitScreening({
        patientId: nextPatientId,
        coughAudioId: coughId,
        speechAudioId: speechId,
        compressedAudioBytes,
        rawAudioBytes: compressedAudioBytes,
        frequencyChartData,
        ...(notes ? { symptomNotes: notes, rawTranscript: notes } : {}),
        ...(spo2Value !== null ? { spo2Percent: spo2Value } : {}),
        ...(rrValue !== null ? { respiratoryRate: rrValue } : {}),
        ...(tempValue !== null ? { temperatureC: tempValue } : {}),
        provisionalMedication: clinical.protocol.lines.join(" "),
        aiClinicalBrief: clinical.brief.synthesis,
        translatedEnText: clinical.brief.translation,
        level1Status: clinical.level1,
        predictedConditions: (
          Object.keys(clinical.probabilities) as Array<keyof typeof clinical.probabilities>
        ).map((key) => ({
          label: clinical.labels[key],
          confidence: clinical.probabilities[key] / 100,
        })),
      });
      setPatientId(nextPatientId);
      setScreeningId(id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "3G dispatch failed. Retry when the signal is stable.",
      );
    } finally {
      setDispatching(false);
    }
  };

  const handleAttach = async (file: File) => {
    if (!patientId) {
      setAttachNotice(null);
      setError("The screening is still saving — attach the document in a moment.");
      return;
    }
    setAttachNotice(null);
    try {
      const uploadUrl = await generateAudioUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error("Document upload failed.");
      const payload: unknown = await response.json();
      if (!isStoragePayload(payload)) throw new Error("Upload did not return a storage id.");
      const docType =
        /x-?ray|dicom|chest/i.test(file.name) || file.type.startsWith("image/")
          ? "xray"
          : "lab_report";
      await attachDocument({
        patientId,
        ...(screeningId ? { screeningId } : {}),
        fileId: payload.storageId,
        docType,
        fileName: file.name,
        notes: "PHC field capture",
      });
      setAttachNotice(`${file.name} attached to the logbook.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not attach this file.");
    }
  };

  /* Feb 2026 contract note: `attachPatientDocument` is only reachable with the
     patient id that the screening mutation returns, so the attach control lives on
     the report screen (after submission), exactly as before. */

  const goHome = () => {
    setError(null);
    setFlow("home");
  };

  const banner = error ? (
    <p className="nv-alert" role="alert">
      {error}
    </p>
  ) : null;

  return (
    <NurseShell
      flow={flow}
      nurseName={nurseName}
      connection={connection}
      onHome={goHome}
      onSignOut={onSignOut}
      animateBackdrop={flow === "home"}
    >
      {banner}

      {flow === "home" && (
        <NurseHomeScreen
          nurseName={nurseName}
          connection={connection}
          inProgress={inProgress}
          onNewEntry={startNewEntry}
          onPatients={() => {
            setError(null);
            setFlow("patients");
          }}
        />
      )}

      {flow === "entry" && step === 1 && (
        <NewEntryScreen
          values={intake}
          onChange={updateIntake}
          ready={intakeReady}
          connection={connection}
          onContinue={() => {
            setError(null);
            setStep(2);
          }}
          onCancel={goHome}
        />
      )}

      {flow === "entry" && step === 2 && (
        <AudioCaptureScreen
          cough={cough}
          phonation={phonation}
          onCapture={handleCapture}
          onRetake={handleRetake}
          onError={(message) => setError(message || null)}
          onSubmit={() => void handleDispatch()}
          onBack={() => {
            setError(null);
            setStep(1);
          }}
          submitting={dispatching}
        />
      )}

      {flow === "entry" && step === 3 && report && (
        <ScreeningReportScreen
          report={report}
          patientLabel={intake.fullName.trim() || "Unnamed patient"}
          attachNotice={attachNotice}
          onAttach={(file) => void handleAttach(file)}
          onFinish={() => {
            clearEntry();
            setFlow("home");
          }}
        />
      )}

      {flow === "patients" && (
        <PatientsReviewsScreen
          onBack={goHome}
          onStartScreening={() => {
            clearEntry();
            setFlow("entry");
          }}
        />
      )}
    </NurseShell>
  );
}
