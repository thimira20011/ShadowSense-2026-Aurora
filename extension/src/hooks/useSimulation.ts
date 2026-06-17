import { useState, useCallback, useRef } from 'react';
import type { SimulationState, AgentResult, StoredResult, DefenseReason } from '../types';
import {
  getThreatLevel,
  getAgentsForLevel,
  getReasonsForLevel,
  getSuggestedResponse,
  getSuggestedTemplates,
} from '../types';

// ─── Reason parser ────────────────────────────────────────────────────────────

/**
 * Maps a raw backend reason string (e.g. "Linguistic Analyst detected: urgency …")
 * to a typed DefenseReason suitable for display in the popup.
 *
 * Strategy:
 *  1. Try to match a known agent-prefix regex → strip prefix, derive type+label
 *  2. Fall back to keyword scanning the full string
 *  3. Default to linguistic
 */
function parseReason(raw: string): DefenseReason {
  const lower = raw.toLowerCase();

  type PrefixEntry = [RegExp, DefenseReason['type'], string];

  const PREFIX_MAP: PrefixEntry[] = [
    [/^Linguistic Analyst (?:detected|flagged|found|reported):\s*/i,  'linguistic', 'Linguistic Alert:'],
    [/^Linguistic(?:\s+(?:Agent|risk|flag))?\s*:\s*/i,                'linguistic', 'Linguistic Alert:'],
    [/^Identity Profiler (?:flagged|detected|found|reported):\s*/i,   'identity',   'Identity Alert:'],
    [/^Identity(?:\s+(?:Agent|risk|flag))?\s*:\s*/i,                  'identity',   'Identity Alert:'],
    [/^Payload Auditor (?:detected|found|flagged|reported):\s*/i,     'payload',    'Payload Alert:'],
    [/^Payload(?:\s+(?:Agent|risk|flag))?\s*:\s*/i,                   'payload',    'Payload Alert:'],
    [/^ChromaDB(?:\s+match)?\s*:\s*/i,                                'linguistic', 'Semantic Match:'],
    [/^Similarity(?:\s+match)?\s*:\s*/i,                              'linguistic', 'Semantic Match:'],
  ];

  for (const [regex, type, label] of PREFIX_MAP) {
    if (regex.test(raw)) {
      return { type, label, description: raw.replace(regex, '').trim() };
    }
  }

  // Fallback: infer from content keywords
  if (
    lower.includes('identity') || lower.includes('account') ||
    lower.includes('profile')  || lower.includes('verified') ||
    lower.includes('member since') || lower.includes('reviews')
  ) {
    return { type: 'identity', label: 'Identity Alert:', description: raw.trim() };
  }

  if (
    lower.includes('payload')  || lower.includes('file') ||
    lower.includes('download') || lower.includes('zip')  ||
    lower.includes('script')   || lower.includes('link') ||
    lower.includes('url')      || lower.includes('malware')
  ) {
    return { type: 'payload', label: 'Payload Alert:', description: raw.trim() };
  }

  if (lower.includes('similar') || lower.includes('chromadb') || lower.includes('pattern match')) {
    return { type: 'linguistic', label: 'Semantic Match:', description: raw.trim() };
  }

  // Default
  return { type: 'linguistic', label: 'Linguistic Alert:', description: raw.trim() };
}

// ─── State builder ────────────────────────────────────────────────────────────

function buildState(
  score: number,
  isStreaming = false,
  result?: StoredResult,
  platform: 'fiverr' | 'upwork' = 'fiverr'
): SimulationState {
  const level = getThreatLevel(score);

  let reasons: DefenseReason[] = getReasonsForLevel(level);
  let suggestedResponse: string  = getSuggestedResponse(level, platform);
  let suggestedTemplates: string[] = getSuggestedTemplates(level, platform);

  if (result) {
    // Map real backend reasons → typed DefenseReasons
    if (result.reasons && result.reasons.length > 0) {
      reasons = result.reasons.map(parseReason);
    }

    // Use backend suggested responses when available
    if (result.suggested_responses && result.suggested_responses.length > 0) {
      suggestedResponse = `"${result.suggested_responses[0]}"`;
      suggestedTemplates = result.suggested_responses;
    }
  }

  return {
    score,
    level,
    agents: getAgentsForLevel(level),
    reasons,
    suggestedResponse,
    suggestedTemplates,
    isStreaming,
  };
}

function queuedAgents(): AgentResult[] {
  return [
    { id: 'linguistic', verdict: 'Wait', state: 'queued' },
    { id: 'identity',   verdict: 'Wait', state: 'queued' },
    { id: 'payload',    verdict: 'Wait', state: 'queued' },
    { id: 'shield',     verdict: 'Wait', state: 'queued' },
  ];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSimulation(initialScore = 22, platform: 'fiverr' | 'upwork' = 'fiverr') {
  const [state, setState] = useState<SimulationState>(
    () => buildState(initialScore, false, undefined, platform)
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateScore = useCallback((score: number, result?: StoredResult) => {
    setState(buildState(score, false, result, platform));
  }, [platform]);

  const cancelSimulation = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const applyPreset = useCallback((score: number) => {
    cancelSimulation();
    setState(buildState(score, false, undefined, platform));
  }, [cancelSimulation, platform]);

  /**
   * Runs the multi-step agent streaming animation (sandbox/demo only).
   * Final resolved state mirrors the actual backend level at score=22.
   */
  const runLiveStream = useCallback(() => {
    cancelSimulation();

    // Safety watchdog: force-resolve after 5 s if something stalls
    const watchdogRef = { id: null as ReturnType<typeof setTimeout> | null };
    watchdogRef.id = setTimeout(() => {
      console.warn('[ShadowSense] Stream watchdog fired — force-resolving');
      setState(buildState(50, false, undefined, platform));
    }, 5000);
    const clearWatchdog = () => {
      if (watchdogRef.id) { clearTimeout(watchdogRef.id); watchdogRef.id = null; }
    };

    // --- Step 0: start streaming ---
    setState({
      score: 0,
      level: 'high-risk',
      agents: queuedAgents(),
      reasons: [],
      suggestedResponse: '',
      suggestedTemplates: [],
      isStreaming: true,
    });

    // --- Step 1: Linguistic starts (t=400 ms) ---
    timerRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        agents: prev.agents.map((a) =>
          a.id === 'linguistic' ? { ...a, verdict: 'Active', state: 'processing' as const } : a
        ),
      }));

      // --- Step 2: Linguistic resolves → Identity starts (t=1600 ms) ---
      timerRef.current = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          agents: prev.agents.map((a) => {
            if (a.id === 'linguistic') return { ...a, verdict: 'Warn',   state: 'resolved' as const };
            if (a.id === 'identity')   return { ...a, verdict: 'Active', state: 'processing' as const };
            return a;
          }),
        }));

        // --- Step 3: Identity resolves → Payload starts (t=2800 ms) ---
        timerRef.current = setTimeout(() => {
          setState((prev) => ({
            ...prev,
            agents: prev.agents.map((a) => {
              if (a.id === 'identity') return { ...a, verdict: 'Clear',  state: 'resolved' as const };
              if (a.id === 'payload')  return { ...a, verdict: 'Active', state: 'processing' as const };
              return a;
            }),
          }));

          // --- Step 4: Payload resolves → Shield starts (t=3800 ms) ---
          timerRef.current = setTimeout(() => {
            setState((prev) => ({
              ...prev,
              agents: prev.agents.map((a) => {
                if (a.id === 'payload') return { ...a, verdict: 'Clear',  state: 'resolved' as const };
                if (a.id === 'shield')  return { ...a, verdict: 'Active', state: 'processing' as const };
                return a;
              }),
            }));

            // --- Step 5: Final result (t=4600 ms) ---
            timerRef.current = setTimeout(() => {
              clearWatchdog();
              setState(buildState(22, false, undefined, platform));
            }, 800);
          }, 1000);
        }, 1200);
      }, 1200);
    }, 400);
  }, [cancelSimulation, platform]);

  return {
    state,
    updateScore,
    applyPreset,
    runLiveStream,
  };
}
