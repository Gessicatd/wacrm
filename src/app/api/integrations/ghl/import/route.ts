import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  decryptGhlToken,
  fetchAllGhlContacts,
  getGhlConnection,
  hashGhlContact,
  normalizeGhlContact,
} from '@/lib/integrations/ghl';

function throwIfError(error: unknown) {
  if (error) throw error;
}

export async function POST() {
  try {
    const ctx = await requireRole('admin');
    const connection = await getGhlConnection(ctx.supabase, ctx.accountId);
    if (connection.error)
      return NextResponse.json(
        { error: 'Failed to load GoHighLevel connection' },
        { status: 500 }
      );
    if (!connection.data)
      return NextResponse.json(
        { error: 'GoHighLevel is not configured' },
        { status: 400 }
      );
    const secret = await ctx.supabase
      .from('ghl_connections')
      .select('encrypted_access_token')
      .eq('account_id', ctx.accountId)
      .eq('id', connection.data.id)
      .single();
    if (secret.error || !secret.data?.encrypted_access_token)
      return NextResponse.json(
        { error: 'GoHighLevel access token is missing' },
        { status: 400 }
      );
    const { data: job, error: jobError } = await ctx.supabase
      .from('ghl_import_jobs')
      .insert({
        account_id: ctx.accountId,
        connection_id: connection.data.id,
        resources: ['contacts'],
        status: 'running',
        started_at: new Date().toISOString(),
        created_by: ctx.userId,
      })
      .select()
      .single();
    if (jobError)
      return NextResponse.json(
        { error: 'Failed to start import job' },
        { status: 500 }
      );
    try {
      const result = await fetchAllGhlContacts(
        decryptGhlToken(secret.data.encrypted_access_token),
        connection.data.location_id
      );
      let imported = 0;
      let skipped = 0;
      for (const contact of result.contacts) {
        if (!contact.id) continue;
        const normalized = normalizeGhlContact(contact);
        const payloadHash = hashGhlContact(contact);
        const existing = await ctx.supabase
          .from('ghl_import_records')
          .select('id,local_id,payload_hash')
          .eq('account_id', ctx.accountId)
          .eq('resource_type', 'contact')
          .eq('external_id', contact.id)
          .maybeSingle();
        throwIfError(existing.error);
        if (existing.data?.payload_hash === payloadHash) {
          const skippedRecord = await ctx.supabase
            .from('ghl_import_records')
            .update({
              job_id: job.id,
              status: 'skipped',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.data.id)
            .eq('account_id', ctx.accountId);
          throwIfError(skippedRecord.error);
          skipped++;
          continue;
        }
        let localId = existing.data?.local_id ?? null;
        let match = normalized.email
          ? await ctx.supabase
              .from('contacts')
              .select('id')
              .eq('account_id', ctx.accountId)
              .ilike('email', normalized.email)
              .limit(1)
              .maybeSingle()
          : { data: null, error: null };
        throwIfError(match.error);
        if (!match.data && normalized.phone) {
          match = await ctx.supabase
            .from('contacts')
            .select('id')
            .eq('account_id', ctx.accountId)
            .eq('phone_normalized', normalized.phone.replace(/\D/g, ''))
            .limit(1)
            .maybeSingle();
          throwIfError(match.error);
        }
        if (match.data?.id) localId = match.data.id;
        if (localId) {
          const updated = await ctx.supabase
            .from('contacts')
            .update({ ...normalized, updated_at: new Date().toISOString() })
            .eq('account_id', ctx.accountId)
            .eq('id', localId);
          throwIfError(updated.error);
        } else {
          const created = await ctx.supabase
            .from('contacts')
            .insert({
              ...normalized,
              account_id: ctx.accountId,
              user_id: ctx.userId,
            })
            .select('id')
            .single();
          if (created.error) throw created.error;
          localId = created.data.id;
        }
        const record = await ctx.supabase
          .from('ghl_import_records')
          .upsert(
            {
              account_id: ctx.accountId,
              job_id: job.id,
              resource_type: 'contact',
              external_id: contact.id,
              local_id: localId,
              payload_hash: payloadHash,
              status: 'imported',
              error: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'account_id,resource_type,external_id' }
          );
        throwIfError(record.error);
        imported++;
      }
      const completed = await ctx.supabase
        .from('ghl_import_jobs')
        .update({
          status: 'completed',
          totals: {
            contacts: result.contacts.length,
            imported,
            skipped,
            pages: result.pages,
          },
          finished_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('account_id', ctx.accountId);
      throwIfError(completed.error);
      const connected = await ctx.supabase
        .from('ghl_connections')
        .update({
          status: 'connected',
          last_import_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.data.id)
        .eq('account_id', ctx.accountId);
      throwIfError(connected.error);
      return NextResponse.json({
        data: {
          job_id: job.id,
          contacts: result.contacts.length,
          imported,
          skipped,
          pages: result.pages,
        },
      });
    } catch (error) {
      await ctx.supabase
        .from('ghl_import_jobs')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Import failed',
          finished_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('account_id', ctx.accountId);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'GoHighLevel import failed',
          job_id: job.id,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
