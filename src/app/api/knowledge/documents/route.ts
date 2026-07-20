import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { createDocument, listDocuments } from '@/lib/knowledge/documents'
export async function GET(){try{const ctx=await requireRole('viewer');const db=await createClient();const {data,error}=await listDocuments(db,ctx.accountId);if(error)return NextResponse.json({error:'Failed to list knowledge documents'},{status:500});return NextResponse.json({data:data??[]})}catch(e){return toErrorResponse(e)}}
export async function POST(req:Request){try{const ctx=await requireRole('admin');const body=await req.json().catch(()=>null);const result=await createDocument(await createClient(),ctx.accountId,ctx.userId,body??{});if(result.error)return NextResponse.json({error:'Failed to create knowledge document'},{status:500});return NextResponse.json({data:result.data},{status:201})}catch(e){return toErrorResponse(e)}}
