import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole,toErrorResponse } from '@/lib/auth/account'
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){try{const ctx=await requireRole('viewer');const {id}=await params;const {data,error}=await (await createClient()).from('knowledge_document_versions').select('id,document_id,version_number,checksum,status,metadata,created_by,created_at').eq('account_id',ctx.accountId).eq('document_id',id).order('version_number',{ascending:false});if(error)return NextResponse.json({error:'Failed to list versions'},{status:500});return NextResponse.json({data:data??[]})}catch(e){return toErrorResponse(e)}}
