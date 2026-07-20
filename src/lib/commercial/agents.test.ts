import { describe, expect, it } from "vitest";
import { COMMERCIAL_AGENTS, agentReadiness, canAutoExecute } from "./agents";

describe("commercial agent governance", () => {
  it("keeps the method agents explicit and account-safe", () => {
    expect(COMMERCIAL_AGENTS.map((agent) => agent.key)).toEqual([
      "diagnosis", "strategy", "inbox", "follow-up", "campaigns", "operations",
    ]);
    expect(COMMERCIAL_AGENTS.every((agent) => agent.knowledge.length > 0 && agent.tools.length > 0)).toBe(true);
  });

  it("does not allow automatic execution before the autonomy mode is automatic", () => {
    expect(canAutoExecute(COMMERCIAL_AGENTS[0], "aplicar tag")).toBe(false);
  });

  it("blocks sensitive actions even when an agent is automatic", () => {
    const automatic = { ...COMMERCIAL_AGENTS[0], status: "active" as const, autonomy: "automatic" as const };
    expect(canAutoExecute(automatic, "aplicar tag")).toBe(true);
    expect(canAutoExecute(automatic, "alterar preço")).toBe(false);
    expect(agentReadiness(automatic)).toBe("Ativo");
  });
});
