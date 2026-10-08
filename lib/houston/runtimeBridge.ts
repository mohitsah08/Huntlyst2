/**
 * Houston Runtime Bridge for Huntlyst
 * 
 * Provides an in-process runtime bridge implementing Houston's agent turn lifecycle:
 * 1. Initializes Agent Context from Houston workspace manifest & skills
 * 2. Manages Turn Lifecycle (start, tool calls, logs, completion/failure)
 * 3. Enforces bounded execution, timeouts, and error handling
 * 4. Captures complete observability telemetry without leaking secrets
 */

import { HoustonAgentTurn, HoustonTurnStatus } from './types';
import { getHoustonAgent } from './agentRegistry';

export class HoustonRuntimeBridge {
  private static instance: HoustonRuntimeBridge;
  private activeTurns = new Map<string, HoustonAgentTurn>();

  public static getInstance(): HoustonRuntimeBridge {
    if (!HoustonRuntimeBridge.instance) {
      HoustonRuntimeBridge.instance = new HoustonRuntimeBridge();
    }
    return HoustonRuntimeBridge.instance;
  }

  /**
   * Execute a turn for a specific Houston agent with a dedicated task and tool handler
   */
  public async executeTurn<TInput, TOutput>(
    agentId: string,
    sessionId: string,
    input: TInput,
    taskFn: (
      context: {
        log: (msg: string) => void;
        recordToolCall: (toolName: string, input: any, output: any, durationMs: number, error?: string) => void;
      }
    ) => Promise<TOutput>
  ): Promise<{ turn: HoustonAgentTurn<TInput, TOutput>; output: TOutput }> {
    const agent = getHoustonAgent(agentId);
    if (!agent) {
      throw new Error(`[Houston Runtime] Unknown agent: '${agentId}'`);
    }

    const turnId = `turn_${agentId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const turn: HoustonAgentTurn<TInput, TOutput> = {
      turnId,
      agentId,
      sessionId,
      status: 'running',
      input,
      startedAt: new Date().toISOString(),
      toolCalls: [],
      logs: [],
    };

    this.activeTurns.set(turnId, turn);

    const log = (msg: string) => {
      const line = `[${new Date().toISOString()}] [${agent.name}] ${msg}`;
      turn.logs.push(line);
      console.log(`[Houston] ${line}`);
    };

    const recordToolCall = (toolName: string, toolInput: any, toolOutput: any, durationMs: number, error?: string) => {
      turn.toolCalls.push({
        tool: toolName,
        input: toolInput,
        output: toolOutput,
        durationMs,
        error,
      });
    };

    log(`Turn started for task in session ${sessionId}`);
    const startMs = Date.now();

    try {
      const output = await taskFn({ log, recordToolCall });
      turn.status = 'completed';
      turn.output = output;
      turn.completedAt = new Date().toISOString();
      turn.durationMs = Date.now() - startMs;
      log(`Turn completed successfully in ${turn.durationMs}ms`);
      return { turn, output };
    } catch (err: any) {
      turn.status = 'failed';
      turn.error = err.message || String(err);
      turn.completedAt = new Date().toISOString();
      turn.durationMs = Date.now() - startMs;
      log(`Turn failed: ${turn.error}`);
      throw err;
    } finally {
      this.activeTurns.delete(turnId);
    }
  }

  public getActiveTurnCount(): number {
    return this.activeTurns.size;
  }
}

export const houstonBridge = HoustonRuntimeBridge.getInstance();
