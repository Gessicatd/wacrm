// ============================================================
// Public API (v1) serializer for RyzeAPI config.
//
// Exposes the minimum necessary fields for an external automation
// (n8n, etc.) to send messages directly through the RyzeAPI REST
// API. The admin token (`api_token`) is NEVER exposed.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/whatsapp/encryption';

export interface ApiRyzeApiConfig {
  api_url: string;
  instance_name: string;
  instance_token: string;
  status: string;
}

/**
 * Load the account's RyzeAPI config and project its public fields.
 * Returns `null` when the account has no RyzeAPI config or the
 * instance is not connected.
 */
export async function getRyzeApiConfig(
  db: SupabaseClient,
  accountId: string,
): Promise<ApiRyzeApiConfig | null> {
  const { data, error } = await db
    .from('ryzeapi_config')
    .select('api_url, instance_name, instance_token, status')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) return null;

  let instanceToken: string;
  try {
    instanceToken = decrypt(data.instance_token);
  } catch {
    return null;
  }

  return {
    api_url: data.api_url,
    instance_name: data.instance_name,
    instance_token: instanceToken,
    status: data.status,
  };
}
