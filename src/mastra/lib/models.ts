import { openai } from "@ai-sdk/openai";
import type { RequestContext } from "@mastra/core/request-context";

/**
 * Resolves the LLM model from the request context.
 * Defaults to gpt-4o-mini. Can be overridden per-request via:
 *   requestContext.set("modelSelection", "gpt-4o")
 */
export function resolveModel(requestContext?: RequestContext) {
  const selection =
    (requestContext?.get("modelSelection") as string | undefined) ?? "gpt-4o-mini";

  switch (selection) {
    case "gpt-4o":
      return openai("gpt-4o");
    case "gpt-4o-mini":
    default:
      return openai("gpt-4o-mini");
  }
}
