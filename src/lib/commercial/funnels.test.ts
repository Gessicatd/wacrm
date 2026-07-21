import { describe, expect, it } from "vitest";
import { FUNNEL_TEMPLATES, getFunnelTemplate } from "./funnels";

describe("methodology funnel templates", () => {
  it("covers multiple acquisition and sales architectures", () => {
    expect(FUNNEL_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(FUNNEL_TEMPLATES.map((item) => item.id)).toEqual(expect.arrayContaining(["service-quiz-sdr-call", "presell-vsl-checkout", "webinar-application", "whatsapp-sdr", "remarketing-recovery"]));
  });

  it("keeps each stage executable and measurable", () => {
    for (const funnel of FUNNEL_TEMPLATES) {
      expect(funnel.stages.length).toBeGreaterThanOrEqual(5);
      expect(funnel.dependencies.length).toBeGreaterThan(0);
      expect(funnel.checklist.length).toBeGreaterThan(4);
      for (const stage of funnel.stages) {
        expect(stage.entryCriteria).toBeTruthy();
        expect(stage.exitCriteria).toBeTruthy();
        expect(stage.requiredFields.length).toBeGreaterThan(0);
        expect(stage.events.length).toBeGreaterThan(0);
      }
    }
  });

  it("returns a safe default for an unknown template", () => {
    expect(getFunnelTemplate("unknown").id).toBe("service-quiz-sdr-call");
  });
});
