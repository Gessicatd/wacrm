import { NextResponse } from 'next/server'
import { getCurrentAccount } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'

export async function GET() {
  try {
    const { accountId } = await getCurrentAccount()
    const db = supabaseAdmin()
    const { data, error } = await db.from('marketing_connections').select('id,provider,status,provider_account_id,provider_account_name,scopes,token_expires_at,connected_at,last_synced_at,last_error').eq('account_id', accountId).order('provider')
    if (error) throw error
    return NextResponse.json({ connections: data ?? [] })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível consultar conexões.' }, { status: 500 }) }
}
