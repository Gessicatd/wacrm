import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/whatsapp/encryption";

const API = "https://services.leadconnectorhq.com";
export type GhlContact = { id?: string; firstName?: string; lastName?: string; name?: string; email?: string; phone?: string; companyName?: string; tags?: string[] };
export function hashPayload(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export function encryptGhlToken(token: string) { return encrypt(token); }
export function decryptGhlToken(token: string) { return decrypt(token); }
export function normalizeGhlContact(contact: GhlContact) { return { name: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null, email: contact.email || null, phone: contact.phone || null, company: contact.companyName || null }; }
export async function fetchGhlContacts(token: string, locationId: string, limit = 100) {
  const response = await fetch(`${API}/contacts/?locationId=${encodeURIComponent(locationId)}&limit=${limit}`, { headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`GoHighLevel contacts request failed (${response.status})`);
  const body = await response.json() as { contacts?: GhlContact[]; meta?: { nextPageUrl?: string } };
  return { contacts: body.contacts ?? [], nextPageUrl: body.meta?.nextPageUrl ?? null };
}
export async function getGhlConnection(db: SupabaseClient, accountId: string) { return db.from("ghl_connections").select("id,location_id,label,status,last_import_at,metadata,created_at,updated_at").eq("account_id", accountId).order("created_at", { ascending: false }).limit(1).maybeSingle(); }
