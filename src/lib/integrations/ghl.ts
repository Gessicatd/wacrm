import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt, encrypt } from '@/lib/whatsapp/encryption';

const API = 'https://services.leadconnectorhq.com';
const API_ORIGIN = new URL(API).origin;
const MAX_CONTACT_PAGES = 100;

export type GhlContact = {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  tags?: string[];
};
export type NormalizedGhlContact = {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
};

function clean(value?: string) {
  return value?.trim() || null;
}
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  return value;
}

export function hashPayload(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}
export function encryptGhlToken(token: string) {
  return encrypt(token);
}
export function decryptGhlToken(token: string) {
  return decrypt(token);
}
export function normalizeGhlContact(contact: GhlContact): NormalizedGhlContact {
  const composedName = [clean(contact.firstName), clean(contact.lastName)]
    .filter(Boolean)
    .join(' ');
  return {
    name: clean(contact.name) || clean(composedName),
    email: clean(contact.email)?.toLowerCase() ?? null,
    phone: clean(contact.phone),
    company: clean(contact.companyName),
  };
}
export function hashGhlContact(contact: GhlContact) {
  return hashPayload(normalizeGhlContact(contact));
}

function safeContactsPageUrl(value: string) {
  const url = new URL(value, API);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/contacts'))
    throw new Error('GoHighLevel returned an unsafe contacts pagination URL');
  return url.toString();
}

export async function fetchGhlContacts(
  token: string,
  locationId: string,
  limit = 100,
  pageUrl?: string
) {
  const url = pageUrl
    ? safeContactsPageUrl(pageUrl)
    : `${API}/contacts/?locationId=${encodeURIComponent(locationId)}&limit=${limit}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: '2021-07-28',
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!response.ok)
    throw new Error(`GoHighLevel contacts request failed (${response.status})`);
  const body = (await response.json()) as {
    contacts?: GhlContact[];
    meta?: { nextPageUrl?: string };
  };
  return {
    contacts: body.contacts ?? [],
    nextPageUrl: body.meta?.nextPageUrl ?? null,
  };
}

export async function fetchAllGhlContacts(token: string, locationId: string) {
  const contacts: GhlContact[] = [];
  const visited = new Set<string>();
  let nextPageUrl: string | undefined;
  let pages = 0;
  do {
    const page = await fetchGhlContacts(token, locationId, 100, nextPageUrl);
    contacts.push(...page.contacts);
    pages += 1;
    if (!page.nextPageUrl) return { contacts, pages };
    const safeUrl = safeContactsPageUrl(page.nextPageUrl);
    if (visited.has(safeUrl))
      throw new Error(
        'GoHighLevel returned a repeated contacts pagination URL'
      );
    visited.add(safeUrl);
    nextPageUrl = safeUrl;
  } while (pages < MAX_CONTACT_PAGES);
  throw new Error(
    `GoHighLevel contacts import exceeded ${MAX_CONTACT_PAGES} pages`
  );
}
export async function getGhlConnection(db: SupabaseClient, accountId: string) {
  return db
    .from('ghl_connections')
    .select(
      'id,location_id,label,status,last_import_at,metadata,created_at,updated_at'
    )
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}
