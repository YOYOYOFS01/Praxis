export type RunStatus =
  | "running"
  | "awaiting_approval"
  | "approved_by_human"
  | "rejected_by_human"
  | "completed"
  | "failed";

export type EventType = "workflow" | "guard" | "proof" | "payment" | "chain" | "hitl";
export type EventStatus = "pending" | "success" | "failed" | "rejected";

export interface RunEventInput {
  type: EventType;
  label: string;
  status: EventStatus;
  payload?: Record<string, unknown>;
}
