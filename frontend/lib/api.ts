import type {
  ApproveRequest,
  AreaProfile,
  AreaSummary,
  Benchmarks,
  Benefit,
  ChatRequest,
  ChatResponse,
  Health,
  Level,
  Lookalike,
  PilotPlan,
  PlanRequest,
  Recommendation,
  RecommendationParams,
  RoiRequest,
  RoiResult,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "1";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, mock: string, init?: RequestInit): Promise<T> {
  const url = USE_MOCK ? `/mock/${mock}` : `${API_BASE}${path}`;
  let res: Response;
  try {
    // mock files are static, so always GET them
    res = await fetch(url, USE_MOCK ? undefined : { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError("Can't reach the Navigator API. Is the backend running?", 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const getHealth = () => request<Health>("/api/health", "health.json");

export const getAreas = (level: Level, state?: string) =>
  request<AreaSummary[]>(
    `/api/areas?level=${level}${state ? `&state=${state}` : ""}`,
    level === "state" ? "areas_state.json" : "areas_county.json",
  );

export const getProfile = (fips: string) => request<AreaProfile>(`/api/areas/${fips}`, "profile.json");

export const getLookalikes = (fips: string, n = 5) =>
  request<Lookalike[]>(`/api/areas/${fips}/lookalikes?n=${n}`, "lookalikes.json");

export function getRecommendations(params: RecommendationParams = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  return request<Recommendation[]>(`/api/recommendations?${q}`, "recommendations.json");
}

export const getBenefits = () => request<Benefit[]>("/api/benefits", "benefits.json");
export const getAssumptions = () => request<Benchmarks>("/api/assumptions", "assumptions.json");
export const postRoi = (req: RoiRequest) => request<RoiResult>("/api/roi", "roi.json", post(req));
export const postChat = (req: ChatRequest) => request<ChatResponse>("/api/chat", "chat.json", post(req));
export const postPlan = (req: PlanRequest) => request<PilotPlan>("/api/plan", "plan.json", post(req));
export const approvePlan = (id: string, req: ApproveRequest) =>
  request<PilotPlan>(`/api/plan/${id}/approve`, "plan.json", post(req));
