import { describe, expect, it } from "vitest";
import { recommendPlaybooks } from "./playbooks";

describe("commercial playbook recommendations", () => {
  it("uses acquisition and offer gaps for decision follow-up", () => {
    expect(recommendPlaybooks({ Aquisição: 35 }).map((item) => item.id)).toContain("post-plan");
    expect(recommendPlaybooks({ Oferta: 35 }).map((item) => item.id)).toContain("post-plan");
  });

  it("uses process and governance gaps for operational controls", () => {
    const ids = recommendPlaybooks({ Processo: 30, Governança: 30 }).map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(["appointment", "won-handoff"]));
  });

  it("adds no-show recovery only for a severe service gap", () => {
    expect(recommendPlaybooks({ Atendimento: 35 }).map((item) => item.id)).toContain("no-show");
    expect(recommendPlaybooks({ Atendimento: 60 }).map((item) => item.id)).not.toContain("no-show");
  });
});
