import { useState, useCallback, useRef } from 'react';
import type { SimulationState, AgentResult } from '../types';
import {
  getThreatLevel,
  getAgentsForLevel,
  getReasonsForLevel,
  getSuggestedResponse,
} from '../types';

function buildState(score: number, isStreaming = false): SimulationState {
  const level = getThreatLevel(score);
  return {
    score,
    level,
    agents: getAgentsForLevel(level),
    reasons: getReasonsForLevel(level),
    suggestedResponse: getSuggestedResponse(level),
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

export function useSimulation(initialScore = 22) {
  const [state, setState] = useState<SimulationState>(() => buildState(initialScore));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateScore = useCallback((score: number) => {
    setState(buildState(score));
  }, []);

  const cancelSimulation = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const applyPreset = useCallback((score: number) => {
    cancelSimulation();
    setState(buildState(score));
  }, [cancelSimulation]);

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
