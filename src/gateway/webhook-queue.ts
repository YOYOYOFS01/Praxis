/**
 * Webhook Queue
 *
 * Enqueues webhook deliveries for x402 gateway events.
 * Fire-and-forget: writes WebhookDelivery rows and returns immediately.
 *
 * Requirements: 13.1, 13.2, 13.7, 14.5
 */

import { prisma } from "@/src/db/prisma";

/**
 * Enqueue a webhook delivery for the given event.
 *
 * Looks up all active WebhookEndpoint rows that match the tenantId scope
 * and have the event subscribed. Creates one WebhookDelivery row per matching
 * endpoint. Does NOT await delivery — fire-and-forget.
 *
 * @param event     - The event name, e.g. "x402.payment.settled"
 * @param payload   - Event payload (will be serialised to JSON)
 * @param tenantId  - Optional tenant to scope the delivery to
 */
export async function enqueueWebhook(
  event: string,
  payload: Record<string, unknown>,
  tenantId?: string
): Promise<void> {
  try {
    // 1. Look up all active endpoints scoped to the tenantId
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: tenantId
        ? {
            isActive: true,
            OR: [{ tenantId }, { tenantId: null }],
          }
        : {
            isActive: true,
          },
    });

    // 2. Filter endpoints that subscribe to this event
    const matchingEndpoints = endpoints.filter((endpoint) => {
      try {
        const subscribedEvents = JSON.parse(endpoint.events) as string[];
        return Array.isArray(subscribedEvents) && subscribedEvents.includes(event);
      } catch {
        // Malformed events JSON — skip this endpoint
        return false;
      }
    });

    if (matchingEndpoints.length === 0) return;

    // 3. Create one WebhookDelivery row per matching endpoint
    const correlationId =
      typeof payload.correlationId === "string" ? payload.correlationId : null;

    await prisma.webhookDelivery.createMany({
      data: matchingEndpoints.map((endpoint) => ({
        endpointId: endpoint.id,
        event,
        payload: JSON.stringify({
          ...payload,
          correlationId: payload.correlationId ?? null,
        }),
        correlationId,
        status: "queued",
        attemptCount: 0,
        nextRetryAt: new Date(), // available for immediate delivery
      })),
    });
  } catch {
    // Swallow all errors — enqueueWebhook must never propagate to payment response
  }
}
