import React from 'react';
import {
  IconMessage2,
  IconUserSearch,
  IconFileZip,
  IconShieldCheck,
  IconShieldX,
  IconShieldHalf,
  IconAlertTriangle,
  IconUserX,
  IconFileAlert,
  IconUserCheck,
  IconFileCheck,
  IconCircleCheck,
  IconLoader,
} from '@tabler/icons-react';
import type { AgentResult, AgentId, AgentVerdict } from '../types';

interface AgentChipsProps {
  agents: AgentResult[];
}

const AGENT_LABELS: Record<AgentId, string> = {
  linguistic: 'Linguistic',
  identity: 'Identity',
  payload: 'Payload',
  shield: 'Shield',
};

function getAgentIcon(id: AgentId, verdict: AgentVerdict, state: string) {
  if (state === 'processing') return <IconLoader size={14} className="spin-icon" />;

  const iconMap: Record<string, Record<string, React.ReactNode>> = {
    linguistic: {
      Risk: <IconAlertTriangle size={14} />,
      Warn: <IconAlertTriangle size={14} />,
      Clear: <IconCircleCheck size={14} />,
      default: <IconMessage2 size={14} />,
    },
    identity: {
      Risk: <IconUserX size={14} />,
      Clear: <IconUserCheck size={14} />,
      default: <IconUserSearch size={14} />,
    },
    payload: {
      Risk: <IconFileAlert size={14} />,
      Clear: <IconFileCheck size={14} />,
      default: <IconFileZip size={14} />,
    },
    shield: {
      Block: <IconShieldX size={14} />,
      Watch: <IconShieldHalf size={14} />,
      Safe: <IconShieldCheck size={14} />,
      Clear: <IconShieldCheck size={14} />,
      default: <IconShieldCheck size={14} />,
    },
  };

  const agentIcons = iconMap[id];
  return agentIcons?.[verdict] || agentIcons?.default || <IconMessage2 size={14} />;
}

function getChipClassName(verdict: AgentVerdict, state: string): string {
  if (state === 'queued') return 'agent-card agent-queued';
  if (state === 'processing') return 'agent-card agent-processing';

  const riskVerdicts = ['Risk', 'Block'];
  const warnVerdicts = ['Warn', 'Watch'];
  const clearVerdicts = ['Clear', 'Safe'];

  if (riskVerdicts.includes(verdict)) return 'agent-card bg-risk-state';
  if (warnVerdicts.includes(verdict)) return 'agent-card bg-warn-state';
  if (clearVerdicts.includes(verdict)) return 'agent-card bg-clear-state';
  return 'agent-card';
}

export const AgentChips: React.FC<AgentChipsProps> = ({ agents }) => {
  return (
    <div className="agents-box">
      <div className="factors-heading">Multi-Agent Response Pipelines</div>
      <div className="agents-grid">
        {agents.map((agent) => (
          <div key={agent.id} className={getChipClassName(agent.verdict, agent.state)}>
            {getAgentIcon(agent.id, agent.verdict, agent.state)}
            <span className="agent-card-title">{AGENT_LABELS[agent.id]}</span>
            <div className="agent-card-status">
              {agent.state === 'processing' ? 'Active' : agent.verdict}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
