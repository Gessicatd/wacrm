import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole,toErrorResponse } from '@/lib/auth/account'
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{const ctx=await requireRole('viewer');const {id}=await params;const limit=Math.min(Number(new URL(req.url).searchParams.get('limit')??200),500);const {data,error}=await (await createClient()).from('knowledge_chunks').select('id,version_id,chunk_index,content,checksum,token_count,metadata,created_at').eq('account_id',ctx.accountId).eq('document_id',id).order('chunk_index').limit(limit);if(error)return NextResponse.json({error:'Failed to list chunks'},{status:500});return NextResponse.json({data:data??[]})}catch(e){return toErrorResponse(e)}}
