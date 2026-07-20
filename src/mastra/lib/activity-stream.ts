/**
 * Activity streaming — emits real-time "thinking" events to the frontend.
 *
 * Mastra's ToolExecutionContext.writer is a ToolStream whose .custom() method
 * is typed as:
 *   <T extends { type: string }>(data: T extends { type: `data-${string}` } ? DataChunkType : T) => Promise<void>
 *
 * We use `unknown` cast to avoid coupling to internal Mastra generics.
 */

// Accepts any Mastra ToolExecutionContext or undefined
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolContext = any;

export interface ActivityPayload {
  agentLabel: string;
  action: string;
  status: "running" | "complete" | "error";
  detail?: string;
}

export async function emitActivity(
  context: AnyToolContext,
  payload: ActivityPayload
): Promise<void> {
  try {
    const custom = context?.writer?.custom;
    if (typeof custom !== "function") return;
    await custom({
      type: "data-agent-activity",
      data: {
        agent:     payload.agentLabel,
        action:    payload.action,
        status:    payload.status,
        detail:    payload.detail ?? null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Never crash a tool because of a streaming failure
  }
}

/**
 * Standard success return shape.
 * The LLM sees `result`; the frontend sees `activity`.
 */
export function activityResult<T>(
  agentLabel: string,
  toolId: string,
  action: string,
  result: T
) {
  return {
    activity: {
      agent:     agentLabel,
      tool:      toolId,
      action,
      status:    "complete" as const,
      timestamp: new Date().toISOString(),
    },
    result,
  };
}
