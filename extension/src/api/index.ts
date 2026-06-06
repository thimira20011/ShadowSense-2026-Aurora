/**
 * Backend API client for Chrome extension
 */

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export interface AnalysisRequest {
  content: string;
  context: Record<string, unknown>;
}

export interface AnalysisResponse {
  threat_level: "low" | "medium" | "high" | "critical";
  confidence: number;
  indicators: Array<{
    type: string;
    description: string;
    confidence: number;
  }>;
  narrative: string;
}

/** Payload sent when the user clicks "Override + Report". */
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

export async function analyzeContent(
  request: AnalysisRequest
): Promise<AnalysisResponse> {
  const response = await fetch(`${API_BASE}/api/analyze/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(
      `Analysis failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export async function submitFeedback(
  analysisId: string,
  wasAccurate: boolean,
  feedback: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/feedback/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      analysis_id: analysisId,
      user_feedback: feedback,
      was_accurate: wasAccurate,
    }),
  });

  if (!response.ok) {
    throw new Error(`Feedback submission failed: ${response.statusText}`);
  }
}

/**
 * Submit an "Override + Report" event when the user disagrees with the
 * ShieldAgent verdict and clicks the Override button.
 *
 * On success the backend:
 *  - Stores the message in ChromaDB with {false_positive: true, trust_score: 22}
 *  - Increments the per-pattern override counter
 *  - Promotes the pattern to benign (+20 trust boost) after 3+ overrides
 */
export async function submitOverride(
  request: OverrideRequest
): Promise<OverrideResponse> {
  const response = await fetch(`${API_BASE}/api/feedback/override`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(
      `Override submission failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<OverrideResponse>;
}

// ─── Pre-Engagement Job Analysis ─────────────────────────────────────────────

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
  /**
   * Pre-Engagement Trust Score: 0 = certain scam, 100 = verified safe.
   * Badge colours: 70-100 🟢 | 40-69 🟡 | 0-39 🔴
   */
  pre_engage_score: number;
  /** 'VERIFIED_SAFE' | 'MODERATE_RISK' | 'HIGH_RISK' */
  verdict: string;
  /** Overall confidence in the verdict 0.0–1.0 */
  confidence: number;
  /** Human-readable risk flags */
  red_flags: string[];
  /** Top ChromaDB semantic matches from the job_scam_patterns collection */
  similar_patterns: SimilarJobPattern[];
  /** Per-signal breakdown of client profile risk */
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
