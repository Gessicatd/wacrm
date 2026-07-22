import { NextResponse } from 'next/server';
import { diagnosticAdmin, findPublicForm } from '@/lib/diagnostics/public-form';

type Params = { params: Promise<{ token: string }> };
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params; const { data, error } = await findPublicForm(token);
  if (error || !data || data.status !== 'open' || (data.expires_at && new Date(data.expires_at) < new Date())) return NextResponse.json({ error: 'Formulário indisponível ou expirado' }, { status: 404 });
  return NextResponse.json({ data });
}
export async function POST(request: Request, { params }: Params) {
  const { token } = await params; const { data: form } = await findPublicForm(token);
  if (!form || form.status !== 'open' || (form.expires_at && new Date(form.expires_at) < new Date())) return NextResponse.json({ error: 'Formulário indisponível ou expirado' }, { status: 404 });
  const body = await request.json().catch(() => null) as { respondent_name?: string; respondent_email?: string; answers?: unknown } | null;
  if (!body || !body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) return NextResponse.json({ error: 'Respostas inválidas' }, { status: 400 });
  const { data, error } = await diagnosticAdmin.from('commercial_diagnostic_responses').insert({ form_id: form.id, respondent_name: typeof body.respondent_name === 'string' ? body.respondent_name.trim() : null, respondent_email: typeof body.respondent_email === 'string' ? body.respondent_email.trim() : null, answers: body.answers, source: 'external_form', review_status: 'pending' }).select('id,created_at').single();
  if (error) return NextResponse.json({ error: 'Não foi possível registrar as respostas' }, { status: 500 });
  await diagnosticAdmin.from('commercial_diagnostic_forms').update({ status: 'submitted', closed_at: new Date().toISOString() }).eq('id', form.id);
  return NextResponse.json({ data }, { status: 201 });
}
