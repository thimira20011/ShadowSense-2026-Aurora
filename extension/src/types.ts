/**
 * ShadowSense Aurora — Central Type Definitions
 */

export type ThreatLevel = 'high-risk' | 'advisory' | 'clear';

export type AgentId = 'linguistic' | 'identity' | 'payload' | 'shield';

export type AgentVerdict = 'Risk' | 'Block' | 'Warn' | 'Watch' | 'Clear' | 'Safe' | 'Wait' | 'Active';

export type AgentProcessingState = 'queued' | 'processing' | 'resolved';

export interface AgentResult {
  id: AgentId;
  verdict: AgentVerdict;
  state: AgentProcessingState;
}

export interface DefenseReason {
  type: 'linguistic' | 'identity' | 'payload';
  label: string;
  description: string;
}

export interface SimulationState {
  score: number;
  level: ThreatLevel;
  agents: AgentResult[];
  reasons: DefenseReason[];
  suggestedResponse: string;
  isStreaming: boolean;
}

export function getThreatLevel(score: number): ThreatLevel {
  if (score <= 39) return 'high-risk';
  if (score <= 69) return 'advisory';
  return 'clear';
}

export function getStatusLabel(level: ThreatLevel): string {
  switch (level) {
    case 'high-risk': return 'High Risk - Blocked';
    case 'advisory': return 'Advisory Warning';
    case 'clear': return 'Clear & Safe';
  }
}

export function getReasonsForLevel(level: ThreatLevel): DefenseReason[] {
  switch (level) {
    case 'high-risk':
      return [
        {
          type: 'linguistic',
          label: 'Linguistic Risk:',
          description: 'Urgent timeline manipulation detected ("3 hours or pick another").',
        },
        {
          type: 'identity',
          label: 'Identity Risk:',
          description: 'Anonymous account created 2 days ago. No payment methods verified.',
        },
        {
          type: 'payload',
          label: 'Payload Risk:',
          description: 'Attached zip archive logo_brief.zip holds hidden script payloads.',
        },
      ];
    case 'advisory':
      return [
        {
          type: 'linguistic',
          label: 'Linguistic Alert:',
          description: 'Buyer requests off-platform communications redirection to Telegram.',
        },
      ];
    case 'clear':
      return [
        {
          type: 'linguistic',
          label: 'No Risks Flagged:',
          description: 'Communication parameters align with legitimate platform use patterns.',
        },
      ];
  }
}

export function getAgentsForLevel(level: ThreatLevel): AgentResult[] {
  switch (level) {
    case 'high-risk':
      return [
        { id: 'linguistic', verdict: 'Risk', state: 'resolved' },
        { id: 'identity', verdict: 'Risk', state: 'resolved' },
        { id: 'payload', verdict: 'Risk', state: 'resolved' },
        { id: 'shield', verdict: 'Block', state: 'resolved' },
      ];
    case 'advisory':
      return [
        { id: 'linguistic', verdict: 'Warn', state: 'resolved' },
        { id: 'identity', verdict: 'Clear', state: 'resolved' },
        { id: 'payload', verdict: 'Clear', state: 'resolved' },
        { id: 'shield', verdict: 'Watch', state: 'resolved' },
      ];
    case 'clear':
      return [
        { id: 'linguistic', verdict: 'Clear', state: 'resolved' },
        { id: 'identity', verdict: 'Clear', state: 'resolved' },
        { id: 'payload', verdict: 'Clear', state: 'resolved' },
        { id: 'shield', verdict: 'Safe', state: 'resolved' },
      ];
  }
}

export function getSuggestedResponse(level: ThreatLevel): string {
  switch (level) {
    case 'high-risk':
      return '"Thank you for reaching out. Please share all project files through the platform\'s official attachment system. I do not accept files via third-party download links."';
    case 'advisory':
      return '"I prefer keeping all messages inside Fiverr for my safety. What details would you like to discuss here?"';
    case 'clear':
      return '"Thank you. I have received the project files and will start working as agreed."';
  }
}

/**
 * Returns 3 pre-written safe response templates for high-risk conversations.
 * Designed to be shown as click-to-copy chips below the chat input.
 */
export function getSuggestedTemplates(level: ThreatLevel): string[] {
  switch (level) {
    case 'high-risk':
      return [
        "Thanks, but I need to verify this request with Fiverr support first.",
        "I'm only able to accept files through the official Fiverr platform. Please use the attachment feature here.",
        "I prefer to keep all communication within Fiverr to protect both of us. Let's continue here.",
      ];
    case 'advisory':
      return [
        "I prefer keeping all messages inside Fiverr for my safety. What details would you like to discuss here?",
      ];
    case 'clear':
      return [];
  }
}
