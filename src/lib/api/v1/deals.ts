import type { SupabaseClient } from '@supabase/supabase-js';

export interface ApiDealContact {
  id: string;
  phone: string;
  name: string | null;
  avatar_url: string | null;
}

export interface ApiDealAssignee {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface ApiDealStage {
  id: string;
  name: string;
  color: string;
}

export interface ApiDeal {
  id: string;
  pipeline_id: string;
  stage_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  assigned_to: string | null;
  title: string;
  value: number;
  currency: string | null;
  notes: string | null;
  expected_close_date: string | null;
  status: 'open' | 'won' | 'lost';
  created_at: string;
  updated_at: string | null;
  contact: ApiDealContact | null;
  stage: ApiDealStage | null;
  assignee: ApiDealAssignee | null;
}

const DEAL_SELECT = `
  *,
  contact:contact_id(id, phone, name, avatar_url),
  stage:stage_id!inner(id, name, color),
  assignee:assigned_to(id, full_name, email, avatar_url)
`;

export function serializeDeal(row: Record<string, unknown>): ApiDeal {
  return {
    id: row.id as string,
    pipeline_id: row.pipeline_id as string,
    stage_id: row.stage_id as string,
    contact_id: (row.contact_id as string | null) ?? null,
    conversation_id: (row.conversation_id as string | null) ?? null,
    assigned_to: (row.assigned_to as string | null) ?? null,
    title: row.title as string,
    value: Number(row.value ?? 0),
    currency: (row.currency as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    expected_close_date: (row.expected_close_date as string | null) ?? null,
    status: (row.status as 'open' | 'won' | 'lost') ?? 'open',
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string | null) ?? null,
    contact: (row.contact as ApiDealContact | null) ?? null,
    stage: (row.stage as ApiDealStage | null) ?? null,
    assignee: (row.assignee as ApiDealAssignee | null) ?? null,
  };
}

export async function getDealById(
  db: SupabaseClient,
  accountId: string,
  dealId: string
): Promise<ApiDeal | null> {
  const { data, error } = await db
    .from('deals')
    .select(DEAL_SELECT)
    .eq('id', dealId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (error || !data) return null;
  return serializeDeal(data as Record<string, unknown>);
}

export interface DealInput {
  pipeline_id: string;
  stage_id: string;
  contact_id: string;
  title: string;
  value?: number;
  currency?: string | null;
  notes?: string | null;
  expected_close_date?: string | null;
  assigned_to?: string | null;
  conversation_id?: string | null;
}

export async function createDeal(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  input: DealInput
): Promise<ApiDeal> {
  const record: Record<string, unknown> = {
    account_id: accountId,
    user_id: userId,
    pipeline_id: input.pipeline_id,
    stage_id: input.stage_id,
    contact_id: input.contact_id,
    title: input.title,
    status: 'open',
  };

  if (input.value !== undefined) record.value = input.value;
  if (input.currency !== undefined && input.currency !== null) record.currency = input.currency;
  if (input.notes !== undefined) record.notes = input.notes;
  if (input.expected_close_date !== undefined) record.expected_close_date = input.expected_close_date;
  if (input.assigned_to !== undefined) record.assigned_to = input.assigned_to;
  if (input.conversation_id !== undefined) record.conversation_id = input.conversation_id;

  const { data, error } = await db
    .from('deals')
    .insert(record)
    .select(DEAL_SELECT)
    .single();

  if (error || !data) {
    console.error('[api/v1/deals] create error:', error);
    throw new Error('Failed to create deal');
  }

  return serializeDeal(data as Record<string, unknown>);
}
