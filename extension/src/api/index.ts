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
