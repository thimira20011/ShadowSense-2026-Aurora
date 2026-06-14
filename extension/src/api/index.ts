/**
 * ShadowSense Aurora — Backend API Client
 *
 * All request/response types are kept in sync with the FastAPI schemas defined
 * in backend/api/analyze.py, backend/api/feedback.py, and backend/api/pre_engage.py.
 */

const API_BASE = "http://localhost:8000";

// ─── /api/analyze ────────────────────────────────────────────────────────────

/** Matches backend ChatMessage Pydantic model */
export interface AnalysisRequest {
  text: string;
  sender?: string;
  timestamp?: string;
  context?: Record<string, unknown>;
}

/** Matches backend TrustScore Pydantic model */
export interface TrustScore {
  score: number;       // 0–100
  level: string;       // "CLEAR" | "ADVISORY" | "HIGH_RISK"
  explanation: string;
}

/** Matches backend DefenseNarrative Pydantic model */
export interface DefenseNarrative {
  trust_score: TrustScore;
  reasons: string[];
  suggested_responses: string[];
}

/** Matches backend AgentDetails Pydantic model */
export interface AgentDetails {
  linguistic: Record<string, unknown>;
  identity: Record<string, unknown>;
  payload: Record<string, unknown>;
  similar_patterns: unknown[];
}

/** Matches backend AnalysisResponse Pydantic model */
export interface AnalysisResponse {
  /** UUID generated per-request — use as feedback analysis_id */
  analysis_id: string;
  trust_score: number;
  verdict: DefenseNarrative;
  agent_details: AgentDetails | null;
}

/** Analyse a single chat message through the 4-agent Shield pipeline. */
export async function analyzeMessage(
  request: AnalysisRequest,
  timeoutMs = 10_000
): Promise<AnalysisResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}/api/analyze/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<AnalysisResponse>;
  } finally {
    clearTimeout(timer);
  }
}

// ─── /api/feedback ───────────────────────────────────────────────────────────

export interface FeedbackRequest {
  analysis_id: string;
  user_feedback: string;
  was_accurate: boolean;
  additional_context?: Record<string, unknown>;
}

export interface FeedbackResponse {
  success: boolean;
  message: string;
}

/** Submit general accuracy feedback (was the detection correct?). */
export async function submitFeedback(
  request: FeedbackRequest
): Promise<FeedbackResponse> {
  const response = await fetch(`${API_BASE}/api/feedback/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Feedback submission failed: ${response.statusText}`);
  }

  return response.json() as Promise<FeedbackResponse>;
}

// ─── /api/feedback/override ──────────────────────────────────────────────────

/** Payload sent when the user clicks "Override + Continue". */
export interface OverrideRequest {
  /** Unique ID of the analysis event returned by /api/analyze. */
  analysis_id: string;
  /** The raw message text that was flagged and is being overridden. */
  pattern_text: string;
  /** Anonymised user identifier. */
  user_id?: string;
  /** The original trust score assigned by ShieldAgent (default 22). */
  trust_score?: number;
}

export interface OverrideResponse {
  success: boolean;
  analysis_id: string;
  /** Short SHA-256 key identifying the pattern in ChromaDB. */
  pattern_key: string;
  /** How many users have now overridden this pattern. */
  override_count: number;
  /** True when ≥ 3 overrides have promoted the pattern to benign. */
  marked_benign: boolean;
  /** +20 if benign, 0 otherwise — applied to future Trust Scores. */
  trust_score_boost: number;
  message: string;
}

/**
 * Submit an "Override + Report" event when the user disagrees with the
 * ShieldAgent verdict and clicks the Override button.
 *
 * On success the backend:
 *  - Stores the message in ChromaDB with {false_positive: true, trust_score}
 *  - Increments the per-pattern override counter
 *  - Promotes the pattern to benign (+20 trust boost) after 3+ overrides
 */
export async function submitOverride(
  request: OverrideRequest
): Promise<OverrideResponse> {
  const response = await fetch(`${API_BASE}/api/feedback/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(
      `Override submission failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<OverrideResponse>;
}

// ─── /api/pre-engage ─────────────────────────────────────────────────────────

export interface ClientProfileRequest {
  reviews?: number;
  rating?: number;
  total_spend?: number;
  member_since_days?: number;
  country?: string;
  verified?: boolean;
  level?: string;
  hire_rate?: number;
  jobs_posted?: number;
}

export interface PreEngageRequest {
  /** Source platform: 'fiverr' or 'upwork' */
  platform: "fiverr" | "upwork";
  /** Canonical URL of the listing */
  job_url: string;
  /** Title of the job posting or gig */
  job_title: string;
  /** Full text of the job description */
  job_description: string;
  /** Listed budget / price (raw string) */
  budget?: string;
  /** Scraped client/buyer profile metadata */
  client_profile?: ClientProfileRequest;
}

export interface SimilarJobPattern {
  text: string;
  similarity: number;
  type: string;
  category: string;
  severity: number;
  red_flags: string[];
}

export interface PreEngageResponse {
  pre_engage_score: number;
  verdict: string;
  confidence: number;
  red_flags: string[];
  similar_patterns: SimilarJobPattern[];
  client_risk_breakdown: Record<string, unknown>;
  platform: string;
  job_url: string;
}

/**
 * Analyse a job/gig listing before the freelancer applies.
 * Returns a Pre-Engagement Trust Score with verdict and red flags.
 */
export async function analyzeJobPosting(
  request: PreEngageRequest
): Promise<PreEngageResponse> {
  const response = await fetch(`${API_BASE}/api/pre-engage/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(
      `Pre-engage analysis failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<PreEngageResponse>;
}

// ─── /health ─────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  providers: Record<string, string>;
}

/** Ping the backend health check — useful for detecting offline state. */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/health`, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json() as Promise<HealthResponse>;
}
