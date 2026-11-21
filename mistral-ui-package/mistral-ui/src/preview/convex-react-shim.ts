/**
 * Development-only stand-in for the parts of `convex/react` the UI uses.
 *
 * Vite aliases `convex/react` to this module only when the dev server runs in
 * `--mode preview` (see vite.config.ts). The normal app and production builds
 * never resolve this file.
 *
 * It is not an authenticated Convex session: no client, no WebSocket, no
 * token. Queries return synthetic fixtures and mutations are logged no-ops.
 */
import { getFunctionName } from "convex/server";
import {
  PREVIEW_NURSE,
  PREVIEW_PATIENTS,
  PREVIEW_QUEUE,
  PREVIEW_SPECIALIST,
  getPreviewLogbook,
} from "./previewData";

function referenceName(reference: unknown): string {
  if (typeof reference === "string") return reference;
  try {
    return getFunctionName(reference as never);
  } catch {
    return "";
  }
}

type Args = Record<string, unknown> | undefined;

const QUERY_RESULTS: Record<string, (args: Args) => unknown> = {
  "triageLogbook:getMyStaffProfile": (args) =>
    args?.role === "nurse" ? PREVIEW_NURSE : PREVIEW_SPECIALIST,
  "triageLogbook:getSpecialistTriageQueue": () => PREVIEW_QUEUE,
  "triageLogbook:getPatientLogbook": (args) =>
    getPreviewLogbook(String(args?.patientId ?? "")),
  "triageLogbook:searchOrListPatients": (args) => {
    const search = String(args?.search ?? "").trim().toLowerCase();
    return PREVIEW_PATIENTS.filter((patient) =>
      patient.fullName.toLowerCase().includes(search) || patient.patientCode.toLowerCase().includes(search),
    );
  },
};

export function useQuery(reference: unknown, args?: unknown): unknown {
  if (args === "skip") return undefined;
  const resolve = QUERY_RESULTS[referenceName(reference)];
  return resolve ? resolve(args as Args) : null;
}

export function useMutation(reference: unknown) {
  const name = referenceName(reference);
  return async (args?: unknown): Promise<unknown> => {
    console.info("[mistral-preview] simulated mutation (no backend call)", name, args);
    switch (name) {
      case "triageLogbook:generateAudioUploadUrl":
        // Never a real upload target: the recording flow stops here in preview.
        return "data:application/octet-stream;base64,";
      case "triageLogbook:createLogbookPatient":
        return "preview-patient";
      case "triageLogbook:submitTriageScreening":
        return "preview-screening";
      default:
        return null;
    }
  };
}

export function useAction(reference: unknown) {
  const name = referenceName(reference);
  return async (args?: unknown): Promise<unknown> => {
    console.info("[mistral-preview] simulated action (no backend call)", name, args);
    return null;
  };
}

export function useConvexAuth() {
  return { isAuthenticated: true, isLoading: false };
}

/**
 * Mirrors the shape of `convex/react`'s real `ConnectionState`. The preview has
 * no socket, but the surfaces that render a sync indicator read this, so it must
 * report a connected state rather than crash the preview build.
 */
export function useConvexConnectionState() {
  return {
    isWebSocketConnected: true,
    hasEverConnected: true,
    connectionCount: 1,
    connectionRetries: 0,
    inflightMutations: 0,
    inflightActions: 0,
    hasInflightRequests: false,
    timeOfOldestInflightRequest: null,
  };
}

class PreviewConvexClient {
  constructor(public address?: string) {}
  close(): void {}
}

export { PreviewConvexClient as ConvexReactClient };
