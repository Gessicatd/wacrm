import type { CreateExecutionInput, CreateMethodologyInput, CreateProjectInput } from "./types";

const text = (value: unknown, field: string, max = 5000): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${field} exceeds the maximum length`);
  return result;
};

export function validateProjectInput(input: unknown): CreateProjectInput {
  const value = (input ?? {}) as Record<string, unknown>;
  return {
    name: text(value.name, "name", 160),
    objective: text(value.objective, "objective", 5000),
    scope: typeof value.scope === "string" ? value.scope.trim().slice(0, 10000) : undefined,
    methodologyId: typeof value.methodology_id === "string" ? value.methodology_id : typeof value.methodologyId === "string" ? value.methodologyId : null,
    targetEndDate: typeof value.target_end_date === "string" ? value.target_end_date : typeof value.targetEndDate === "string" ? value.targetEndDate : null,
  };
}

export function validateMethodologyInput(input: unknown): CreateMethodologyInput {
  const value = (input ?? {}) as Record<string, unknown>;
  return {
    name: text(value.name, "name", 160),
    description: typeof value.description === "string" ? value.description.trim().slice(0, 10000) : undefined,
    sourceType: typeof value.source_type === "string" ? value.source_type.trim().slice(0, 80) : undefined,
    sourceReference: typeof value.source_reference === "string" ? value.source_reference.trim().slice(0, 2000) : undefined,
  };
}

export function validateExecutionInput(input: unknown): CreateExecutionInput {
  const value = (input ?? {}) as Record<string, unknown>;
  if (!value.input || typeof value.input !== "object" || Array.isArray(value.input)) throw new Error("input must be an object");
  const readId = (key: string) => typeof value[key] === "string" ? value[key] as string : null;
  return {
    methodologyId: readId("methodology_id") ?? readId("methodologyId"),
    stepId: readId("step_id") ?? readId("stepId"),
    agentId: readId("agent_id") ?? readId("agentId"),
    workflowId: readId("workflow_id") ?? readId("workflowId"),
    input: value.input as Record<string, unknown>,
    idempotencyKey: readId("idempotency_key") ?? readId("idempotencyKey"),
  };
}
