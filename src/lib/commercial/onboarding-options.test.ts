import { describe, expect, it } from "vitest";
import { ONBOARDING_OPTIONS } from "./onboarding-options";

describe("onboarding answer options", () => {
  it("uses actionable answers for the follow-up question", () => {
    expect(ONBOARDING_OPTIONS.followup).toContain("Mandamos uma mensagem depois");
    expect(ONBOARDING_OPTIONS.followup.join(" ")).not.toMatch(/existe e é padronizado|depende de cada vendedor/i);
  });

  it("keeps call answers about the type of conversation", () => {
    expect(ONBOARDING_OPTIONS.callProcess).toContain("Não fazemos essa conversa");
    expect(ONBOARDING_OPTIONS.callProcess.join(" ")).not.toMatch(/roteiro e critérios|varia/i);
  });

  it("has a non-blocking fallback for every selection", () => {
    for (const options of Object.values(ONBOARDING_OPTIONS)) expect(options.length).toBeGreaterThan(1);
  });
});
