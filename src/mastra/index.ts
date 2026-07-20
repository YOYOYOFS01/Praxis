import { Mastra } from "@mastra/core";
import { procurementAgent } from "./agents/procurement-agent";
import { guardAgent }       from "./agents/guard-agent";
import { proofAgent }       from "./agents/proof-agent";

/**
 * Central Mastra instance.
 * Agent keys MUST match agent.id.
 *
 * After construction, initializeActivityStreaming() wraps every tool's
 * execute() to inject activeToolId and toolExecutionId into every context
 * automatically — no tool needs to set it manually.
 */
export const mastra = new Mastra({
  agents: {
    "procurement-agent": procurementAgent,
    "guard-agent":       guardAgent,
    "proof-agent":       proofAgent,
  },
});

// ── Tool decoration — inject activeToolId into every tool context ────────────
function initializeActivityStreaming(instance: Mastra) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTools: Record<string, unknown> = (instance as any).listTools?.() ?? {};

  for (const [key, tool] of Object.entries(allTools)) {
    const t = tool as { execute?: Function; id?: string };
    if (!t.execute || (t.execute as { __wrapped?: boolean }).__wrapped) continue;

    const original = t.execute.bind(t);

    const wrapped = async function (inputData: unknown, context: Record<string, unknown> | undefined) {
      if (context) {
        context["activeToolId"]       = t.id ?? key;
        context["toolExecutionId"]    = `${key}_${Math.random().toString(36).slice(2, 11)}`;
      }
      return original(inputData, context);
    };

    (wrapped as { __wrapped?: boolean }).__wrapped = true;
    t.execute = wrapped;
  }
}

initializeActivityStreaming(mastra);

// Re-export for direct use in the workflow
export { procurementAgent, guardAgent, proofAgent };
