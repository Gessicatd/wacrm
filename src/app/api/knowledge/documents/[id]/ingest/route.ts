import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole,toErrorResponse } from '@/lib/auth/account'
import { ingestText } from '@/lib/knowledge/ingestion'
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const ctx=await requireRole('admin');const {id}=await params;const body=await req.json().catch(()=>null);if(typeof body?.text!=='string'||typeof body?.idempotency_key!=='string')return NextResponse.json({error:'text and idempotency_key are required'},{status:400});const result=await ingestText(await createClient(),{accountId:ctx.accountId,actorId:ctx.userId,documentId:id,text:body.text,idempotencyKey:body.idempotency_key,maxChars:body.max_chars,overlapChars:body.overlap_chars});return NextResponse.json({data:result},{status:201})}catch(e){return toErrorResponse(e)}}
