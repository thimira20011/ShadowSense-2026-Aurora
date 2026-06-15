import { useState, useCallback, useRef } from 'react';
import type { SimulationState, AgentResult, StoredResult, DefenseReason } from '../types';
import {
  getThreatLevel,
  getAgentsForLevel,
  getReasonsForLevel,
  getSuggestedResponse,
  getSuggestedTemplates,
} from '../types';

function buildState(
  score: number,
  isStreaming = false,
  result?: StoredResult,
  platform: 'fiverr' | 'upwork' = 'fiverr'
): SimulationState {
  const level = getThreatLevel(score);

  let reasons: DefenseReason[] = getReasonsForLevel(level);
  let suggestedResponse: string = getSuggestedResponse(level, platform);
  let suggestedTemplates: string[] = getSuggestedTemplates(level, platform);

  if (result) {
    if (result.reasons && result.reasons.length > 0) {
      reasons = result.reasons.map((r: string) => {
        let type: 'linguistic' | 'identity' | 'payload' = 'linguistic';
        let label = 'Linguistic Alert:';
        let description = r;

        const lower = r.toLowerCase();
        if (lower.includes('identity') || lower.includes('profile')) {
          type = 'identity';
          label = 'Identity Alert:';
        } else if (
          lower.includes('payload') ||
          lower.includes('auditor') ||
          lower.includes('file') ||
          lower.includes('threat') ||
          lower.includes('link')
        ) {
          type = 'payload';
          label = 'Payload Alert:';
        } else if (
          lower.includes('linguistic') ||
          lower.includes('urgency') ||
          lower.includes('language')
        ) {
          type = 'linguistic';
          label = 'Linguistic Alert:';
        } else if (lower.includes('chromadb') || lower.includes('similarity')) {
          type = 'linguistic';
          label = 'Semantic Match:';
        }

        const prefixes = [
          /^Linguistic Analyst detected:\s*/i,
          /^Identity Profiler flagged:\s*/i,
          /^Payload Auditor found:\s*/i,
          /^ChromaDB:\s*/i,
        ];
        for (const p of prefixes) {
          if (p.test(description)) {
            description = description.replace(p, '');
            break;
          }
        }

        return { type, label, description };
      });
    }

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
    { id: 'identity', verdict: 'Wait', state: 'queued' },
    { id: 'payload', verdict: 'Wait', state: 'queued' },
    { id: 'shield', verdict: 'Wait', state: 'queued' },
  ];
}

export function useSimulation(initialScore = 22, platform: 'fiverr' | 'upwork' = 'fiverr') {
  const [state, setState] = useState<SimulationState>(() => buildState(initialScore, false, undefined, platform));
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

  const runLiveStream = useCallback(() => {
    cancelSimulation();

    // Safety watchdog: if streaming is still active after 5s, force-resolve
    // to prevent the gauge from getting stuck in loading state.
    const watchdogRef = { id: null as ReturnType<typeof setTimeout> | null };
    watchdogRef.id = setTimeout(() => {
      console.warn('[ShadowSense] Stream watchdog fired — force-resolving stuck stream');
      setState(buildState(50)); // advisory default
    }, 5000);

    const clearWatchdog = () => {
      if (watchdogRef.id) { clearTimeout(watchdogRef.id); watchdogRef.id = null; }
    };

    // Initial streaming state
    setState({
      score: 0,
      level: 'high-risk',
      agents: queuedAgents(),
      reasons: [],
      suggestedResponse: '',
      isStreaming: true,
    });

    // Step 1: Linguistic starts (t=400ms)
    timerRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        agents: prev.agents.map((a) =>
          a.id === 'linguistic' ? { ...a, verdict: 'Active', state: 'processing' as const } : a
        ),
      }));

      // Step 2: Linguistic resolves, Identity starts (t=1600ms)
      timerRef.current = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          agents: prev.agents.map((a) => {
            if (a.id === 'linguistic') return { ...a, verdict: 'Risk', state: 'resolved' as const };
            if (a.id === 'identity') return { ...a, verdict: 'Active', state: 'processing' as const };
            return a;
          }),
        }));

        // Step 3: Identity resolves, Payload starts (t=2800ms)
        timerRef.current = setTimeout(() => {
          setState((prev) => ({
            ...prev,
            agents: prev.agents.map((a) => {
              if (a.id === 'identity') return { ...a, verdict: 'Risk', state: 'resolved' as const };
              if (a.id === 'payload') return { ...a, verdict: 'Active', state: 'processing' as const };
              return a;
            }),
          }));

          // Step 4: Payload resolves, Shield starts (t=3800ms)
          timerRef.current = setTimeout(() => {
            setState((prev) => ({
              ...prev,
              agents: prev.agents.map((a) => {
                if (a.id === 'payload') return { ...a, verdict: 'Risk', state: 'resolved' as const };
                if (a.id === 'shield') return { ...a, verdict: 'Active', state: 'processing' as const };
                return a;
              }),
            }));

            // Step 5: Final result (t=4600ms)
            timerRef.current = setTimeout(() => {
              clearWatchdog();
              setState(buildState(22));
            }, 800);
          }, 1000);
        }, 1200);
      }, 1200);
    }, 400);
  }, [cancelSimulation]);


  return {
    state,
    updateScore,
    applyPreset,
    runLiveStream,
  };
}
