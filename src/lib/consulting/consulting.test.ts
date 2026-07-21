import { describe, expect, it } from "vitest";
import { buildExecutionPlan, nextRunnableStep } from "./orchestration";
import { validateExecutionInput, validateProjectInput } from "./validation";

describe("consulting methodology engine", () => {
  it("validates project inputs without accepting blank names", () => {
    expect(validateProjectInput({ name: " Projeto ", objective: " Organizar vendas " })).toMatchObject({ name: "Projeto", objective: "Organizar vendas" });
    expect(() => validateProjectInput({ name: "", objective: "x" })).toThrow("name is required");
  });

  it("builds a dependency-safe execution order", () => {
    const steps = [
      { id: "b", sequence: 2, execution_type: "agent" as const, dependencies: ["a"] },
      { id: "a", sequence: 1, execution_type: "hybrid" as const, dependencies: [] },
    ];
    expect(buildExecutionPlan(steps).map((step) => step.id)).toEqual(["a", "b"]);
    expect(nextRunnableStep(steps, [])?.id).toBe("a");
    expect(nextRunnableStep(steps, ["a"])?.id).toBe("b");
  });

  it("rejects dependency cycles", () => {
    const steps = [
      { id: "a", sequence: 1, execution_type: "agent" as const, dependencies: ["b"] },
      { id: "b", sequence: 2, execution_type: "agent" as const, dependencies: ["a"] },
    ];
    expect(() => buildExecutionPlan(steps)).toThrow("dependency cycle");
  });

  it("requires structured execution input", () => {
    expect(validateExecutionInput({ input: { company: "Acme" }, idempotency_key: "run-1" })).toMatchObject({ idempotencyKey: "run-1" });
    expect(() => validateExecutionInput({ input: "not-an-object" })).toThrow("input must be an object");
  });
});
