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
