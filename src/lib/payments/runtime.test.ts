import { describe, expect, it } from "vitest";
import { assertPaymentTransition, createSandboxCharge, validateCreatePaymentInput } from "./runtime";

describe("payment runtime", () => {
  it("validates and creates a sandbox Pix charge without external credentials", () => {
    const input = validateCreatePaymentInput({ method: "pix", amount_cents: 20000, description: "Consulta", external_reference: "appointment-1" });
    const charge = createSandboxCharge(input);
    expect(charge.providerPaymentId).toMatch(/^sandbox_/);
    expect(charge.pixCopyPaste).toContain("BR.GOV.BCB.PIX");
    expect(charge.checkoutUrl).toBeNull();
  });

  it("rejects unsafe amount and invalid transitions", () => {
    expect(() => validateCreatePaymentInput({ method: "pix", amount_cents: 0, description: "x", external_reference: "y" })).toThrow();
    expect(() => assertPaymentTransition("paid", "expired")).toThrow(/Invalid payment transition/);
  });
});
