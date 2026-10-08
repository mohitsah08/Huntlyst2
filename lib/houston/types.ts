/**
 * Houston Agent Infrastructure Types for Huntlyst2
 * 
 * Provides type definitions conforming to Houston's agent runtime architecture
 * (packages/runtime, packages/domain, packages/protocol) specialized for Huntlyst.
 */

export interface HoustonAgentManifest {
  id: string;
  configId: string;
  name: string;
  color: string;
  role: string;
  industry: string;
  skills: string[];
  tools: string[];
  systemPrompt: string;
}

export type HoustonTurnStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';

export interface HoustonAgentTurn<TInput = any, TOutput = any> {
  turnId: string;
  agentId: string;
  sessionId: string;
  status: HoustonTurnStatus;
  input: TInput;
  output?: TOutput;
  error?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  toolCalls: Array<{
    tool: string;
    input: any;
    output?: any;
    durationMs: number;
    error?: string;
  }>;
  logs: string[];
}

export interface HoustonWorkspaceConfig {
  workspaceId: string;
  name: string;
  path: string;
  agents: HoustonAgentManifest[];
}
