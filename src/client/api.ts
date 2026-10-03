import type { ReasonCategory, Side } from "@/domain/experiment/types";
import type {
  CompleteResponse,
  DashboardData,
  InsightView,
  RecordChoiceResponse,
  StartParticipantResponse,
} from "@/contracts/responses";

/** Typed browser client for the SwitchPoint API. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong");
  return data as T;
}

const post = <T>(url: string, body: unknown = {}) =>
  request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const withVersion = (path: string, version?: string) =>
  version ? `${path}?version=${encodeURIComponent(version)}` : path;

export const participantApi = {
  start: () => post<StartParticipantResponse>("/api/participants"),
  choose: (participantId: string, scenarioId: string, side: Side) =>
    post<RecordChoiceResponse>("/api/choices", { participantId, scenarioId, side }),
  state: (participantId: string, reasonText: string, statedPriceThreshold: number | null) =>
    post<{ ok: true }>("/api/stated", { participantId, reasonText, statedPriceThreshold }),
  complete: (participantId: string) => post<CompleteResponse>("/api/complete", { participantId }),
};

export const adminApi = {
  login: (password: string) => post<{ ok: true }>("/api/admin/login", { password }),
  logout: () => post<{ ok: true }>("/api/admin/logout"),
  results: (version?: string) =>
    request<DashboardData>(withVersion("/api/results", version), { cache: "no-store" }),
  generateInsight: (version?: string) => post<InsightView>(withVersion("/api/admin/insight", version)),
  reclassify: (version?: string) => post<{ queued: number }>(withVersion("/api/admin/reclassify", version)),
  overrideCategory: (participantId: string, category: ReasonCategory | null) =>
    post<{ ok: true }>("/api/admin/override", { participantId, category }),
  markFulfilled: (participantId: string) => post<{ ok: true }>("/api/admin/fulfil", { participantId }),
  exportUrl: (table: "choices" | "stated", version: string) =>
    `/api/admin/export?table=${table}&version=${encodeURIComponent(version)}`,
};
