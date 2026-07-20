import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole,toErrorResponse } from '@/lib/auth/account'
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){try{const ctx=await requireRole('viewer');const {id}=await params;const {data,error}=await (await createClient()).from('knowledge_ingestion_jobs').select('*').eq('account_id',ctx.accountId).eq('id',id).maybeSingle();if(error)return NextResponse.json({error:'Failed to load ingestion job'},{status:500});if(!data)return NextResponse.json({error:'Not found'},{status:404});return NextResponse.json({data})}catch(e){return toErrorResponse(e)}}
