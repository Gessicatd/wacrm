import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt, encrypt } from '@/lib/whatsapp/encryption';

const MAX_PAGES = 100;
export type KommoContact = { id?: number | string; name?: string; custom_fields_values?: Array<{ field_name?: string; values?: Array<{ value?: string }> }> };
export type NormalizedKommoContact = { name: string | null; email: string | null; phone: string | null; company: string | null };
const clean = (value?: string) => value?.trim() || null;
export function normalizeKommoContact(contact: KommoContact): NormalizedKommoContact {
  let email: string | null = null; let phone: string | null = null;
  for (const field of contact.custom_fields_values ?? []) { const name = (field.field_name ?? '').toLowerCase(); const value = clean(field.values?.[0]?.value); if (name.includes('email')) email = value?.toLowerCase() ?? null; if (name.includes('phone') || name.includes('telefone')) phone = value; }
  return { name: clean(contact.name), email, phone, company: null };
}
export function hashKommoContact(contact: KommoContact) { return createHash('sha256').update(JSON.stringify(normalizeKommoContact(contact))).digest('hex'); }
export const encryptKommoToken = (token: string) => encrypt(token);
export const decryptKommoToken = (token: string) => decrypt(token);
function apiBase(subdomain: string) { if (!/^[a-z0-9][a-z0-9-]{1,62}$/i.test(subdomain)) throw new Error('Invalid Kommo subdomain'); return `https://${subdomain}.kommo.com`; }
export async function fetchKommoContacts(token: string, subdomain: string, page = 1) {
  const response = await fetch(`${apiBase(subdomain)}/api/v4/contacts?page=${page}&limit=250`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/hal+json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Kommo contacts request failed (${response.status})`);
  const body = await response.json() as { _embedded?: { contacts?: KommoContact[] }; _page?: number; _links?: { next?: { href?: string } } };
  const next = body._links?.next?.href; if (next && !next.startsWith(`${apiBase(subdomain)}/api/v4/contacts`)) throw new Error('Kommo returned an unsafe pagination URL');
  return { contacts: body._embedded?.contacts ?? [], hasNext: Boolean(next) };
}
export async function fetchAllKommoContacts(token: string, subdomain: string) { const contacts: KommoContact[] = []; for (let page = 1; page <= MAX_PAGES; page++) { const result = await fetchKommoContacts(token, subdomain, page); contacts.push(...result.contacts); if (!result.hasNext) return { contacts, pages: page }; } throw new Error(`Kommo import exceeded ${MAX_PAGES} pages`); }
export function getKommoConnection(db: SupabaseClient, accountId: string) { return db.from('kommo_connections').select('id,subdomain,label,status,last_import_at,metadata,created_at,updated_at').eq('account_id', accountId).order('created_at', { ascending: false }).limit(1).maybeSingle(); }
