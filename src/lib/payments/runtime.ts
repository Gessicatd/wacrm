import { randomUUID } from "node:crypto";

export type PaymentMethod = "pix" | "gateway";
export type PaymentStatus = "pending" | "paid" | "expired" | "cancelled" | "refunded" | "failed";

export interface CreatePaymentInput {
  method: PaymentMethod;
  amountCents: number;
  description: string;
  externalReference: string;
  expiresAt?: string | null;
}

export interface ProviderCharge {
  providerPaymentId: string;
  checkoutUrl: string | null;
  pixCopyPaste: string | null;
  expiresAt: string | null;
}

const MAX_AMOUNT_CENTS = 100_000_000;

export function validateCreatePaymentInput(value: unknown): CreatePaymentInput {
  if (!value || typeof value !== "object") throw new Error("Payment input is required");
  const body = value as Record<string, unknown>;
  const method = body.method;
  const amountCents = body.amount_cents;
  const description = body.description;
  const externalReference = body.external_reference;
  if (method !== "pix" && method !== "gateway") throw new Error("method must be pix or gateway");
  if (!Number.isInteger(amountCents) || Number(amountCents) < 1 || Number(amountCents) > MAX_AMOUNT_CENTS) {
    throw new Error("amount_cents must be an integer between 1 and 100000000");
  }
  if (typeof description !== "string" || description.trim().length < 1 || description.trim().length > 500) {
    throw new Error("description must contain between 1 and 500 characters");
  }
  if (typeof externalReference !== "string" || externalReference.trim().length < 1 || externalReference.trim().length > 180) {
    throw new Error("external_reference must contain between 1 and 180 characters");
  }
  const expiresAt = body.expires_at == null ? null : body.expires_at;
  if (expiresAt !== null && typeof expiresAt !== "string") throw new Error("expires_at must be an ISO date or null");
  return { method, amountCents: Number(amountCents), description: description.trim(), externalReference: externalReference.trim(), expiresAt };
}

/** Deterministic sandbox adapter. It never calls a bank or gateway. */
export function createSandboxCharge(input: CreatePaymentInput): ProviderCharge {
  const providerPaymentId = `sandbox_${randomUUID()}`;
  if (input.method === "pix") {
    return {
      providerPaymentId,
      checkoutUrl: null,
      pixCopyPaste: `00020126360014BR.GOV.BCB.PIX0114${providerPaymentId.slice(0, 14)}520400005303986540${(input.amountCents / 100).toFixed(2)}5802BR5913WACRM SANDBOX6009FORTALEZA62070503***6304ABCD`,
      expiresAt: input.expiresAt ?? new Date(Date.now() + 30 * 60_000).toISOString(),
    };
  }
  return {
    providerPaymentId,
    checkoutUrl: `https://sandbox.wacrm.local/checkout/${providerPaymentId}`,
    pixCopyPaste: null,
    expiresAt: input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
  };
}

export function assertPaymentTransition(current: PaymentStatus, next: PaymentStatus): void {
  if (current === next) return;
  const allowed: Record<PaymentStatus, PaymentStatus[]> = {
    pending: ["paid", "expired", "cancelled", "failed"],
    paid: ["refunded"],
    expired: [],
    cancelled: [],
    refunded: [],
    failed: ["pending"],
  };
  if (!allowed[current].includes(next)) throw new Error(`Invalid payment transition: ${current} -> ${next}`);
}
