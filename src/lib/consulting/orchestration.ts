import type { ExecutionStatus, StepExecutionType } from "./types";

export interface PlanStep {
  id: string;
  sequence: number;
  execution_type: StepExecutionType;
  dependencies: string[];
}

export function buildExecutionPlan(steps: PlanStep[]): PlanStep[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const ordered: PlanStep[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error("Methodology contains a dependency cycle");
    const step = byId.get(id);
    if (!step) throw new Error(`Unknown methodology dependency: ${id}`);
    visiting.add(id);
    step.dependencies.forEach(visit);
    visiting.delete(id);
    visited.add(id);
    ordered.push(step);
  };
  [...steps].sort((a, b) => a.sequence - b.sequence).forEach((step) => visit(step.id));
  return ordered;
}

export function nextRunnableStep(steps: PlanStep[], completedIds: string[]): PlanStep | null {
  const complete = new Set(completedIds);
  return buildExecutionPlan(steps).find((step) => !complete.has(step.id) && step.dependencies.every((dependency) => complete.has(dependency))) ?? null;
}

export function isTerminalExecutionStatus(status: ExecutionStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}
