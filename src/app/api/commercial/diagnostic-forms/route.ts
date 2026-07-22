import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { hashDiagnosticToken, issueDiagnosticToken } from '@/lib/diagnostics/public-form';

const defaultQuestions = [
  { key: 'business_name', label: 'Qual é o nome da empresa?', required: true },
  { key: 'segment', label: 'Em qual segmento vocês atuam e em qual região?', required: true },
  { key: 'offer', label: 'O que vocês vendem hoje e qual é o ticket médio?', required: true },
  { key: 'ideal_customer', label: 'Quem é o cliente ideal?', required: true },
  { key: 'acquisition', label: 'De onde vêm as oportunidades atualmente?', required: true },
  { key: 'bottleneck', label: 'Onde o processo mais perde oportunidades?', required: true },
  { key: 'goal_90_days', label: 'Que resultado precisa acontecer nos próximos 90 dias?', required: true },
  { key: 'evidence', label: 'Quais números, documentos ou exemplos podemos revisar?', required: false },
];

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = await request.json().catch(() => ({})) as { title?: string; expires_at?: string; questions?: unknown };
    const token = issueDiagnosticToken();
    const { data, error } = await ctx.supabase.from('commercial_diagnostic_forms').insert({ account_id: ctx.accountId, title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Diagnóstico empresarial', questions: Array.isArray(body.questions) ? body.questions : defaultQuestions, expires_at: body.expires_at ?? null, token_hash: hashDiagnosticToken(token), created_by: ctx.userId }).select('id,title,questions,status,expires_at,created_at').single();
    if (error) return NextResponse.json({ error: 'Não foi possível criar o formulário' }, { status: 500 });
    return NextResponse.json({ data, link: `/public/diagnostico/${token}` }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}

export async function GET() {
  try { const ctx = await requireRole('admin'); const { data, error } = await ctx.supabase.from('commercial_diagnostic_forms').select('id,title,status,expires_at,created_at').eq('account_id', ctx.accountId).order('created_at', { ascending: false }); if (error) return NextResponse.json({ error: 'Não foi possível listar formulários' }, { status: 500 }); return NextResponse.json({ data: data ?? [] }); } catch (error) { return toErrorResponse(error); }
}
