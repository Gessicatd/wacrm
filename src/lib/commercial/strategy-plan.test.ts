import { describe, expect, it } from "vitest";
import { buildStrategyPlan } from "./strategy-plan";

describe("strategy plan generator", () => {
  it("creates a traceable plan from the assessment without external AI", () => {
    const plan = buildStrategyPlan({ specialty: "Clínica de estética", primary_offer: "Protocolo facial", target_90_days: "Converter melhor" }, { answers: { idealCustomer: "Mulheres 35+" }, dimension_scores: { Atendimento: 20, Oferta: 50, Estratégia: 70 } });
    expect(plan.positioning.offer).toBe("Protocolo facial");
    expect(plan.priorities[0].dimension).toBe("Atendimento");
    expect(plan.ninetyDays).toHaveLength(3);
    expect(plan.evidenceNeeded.length).toBeGreaterThan(2);
    expect(plan.methodologyBasis.length).toBeGreaterThan(4);
    expect(plan.businessDiagnosis.unknowns.length).toBeGreaterThan(0);
    expect(plan.offerArchitecture.scope.length).toBeGreaterThan(2);
    expect(plan.funnel.stagesDetail).toHaveLength(6);
    expect(plan.governance.approvals.join(" ")).toContain("Proprietário");
    expect(plan.ninetyDays[0].acceptance.length).toBeGreaterThan(0);
  });

  it("remains usable when the assessment is incomplete", () => {
    const plan = buildStrategyPlan(null, null);
    expect(plan.title).toContain("serviço high-ticket");
    expect(plan.funnel.stages.length).toBeGreaterThan(4);
    expect(plan.version).toContain("v2.0");
    expect(plan.businessDiagnosis.unknowns.length).toBeGreaterThan(0);
  });
});
