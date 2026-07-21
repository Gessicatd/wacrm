export type ConsultingProjectStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type MethodologyStatus = "draft" | "in_review" | "published" | "archived";
export type StepExecutionType = "manual" | "automated" | "agent" | "workflow" | "hybrid";
export type ExecutionStatus = "queued" | "running" | "waiting_review" | "completed" | "failed" | "cancelled";
export type ArtifactStatus = "draft" | "in_review" | "approved" | "archived";

export interface CreateProjectInput {
  name: string;
  objective: string;
  scope?: string;
  methodologyId?: string | null;
  targetEndDate?: string | null;
}

export interface CreateMethodologyInput {
  name: string;
  description?: string;
  sourceType?: string;
  sourceReference?: string;
}

export interface CreateExecutionInput {
  methodologyId?: string | null;
  stepId?: string | null;
  agentId?: string | null;
  workflowId?: string | null;
  input: Record<string, unknown>;
  idempotencyKey?: string | null;
}

export interface ExecutionEnvelope {
  executionId: string;
  projectId: string;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  stepId: string | null;
  agentId: string | null;
  workflowId: string | null;
}

export interface ArtifactInput {
  projectId: string;
  executionId?: string | null;
  type: string;
  title: string;
  content: Record<string, unknown>;
  status?: ArtifactStatus;
  evidence?: unknown[];
}

export interface RecommendationInput {
  projectId: string;
  artifactId?: string | null;
  description: string;
  rationale?: string;
  impact?: string;
  effort?: string;
  priority?: string;
  evidence?: unknown[];
}

export interface ActionItemInput {
  projectId: string;
  recommendationId?: string | null;
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string | null;
  kpi?: string | null;
}
