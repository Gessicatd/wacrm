import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { MODULES, normalizePermission, type PermissionModule } from '@/lib/auth/permissions';

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const ctx = await requireRole('admin');
    const { userId } = await params;
    const { data, error } = await ctx.supabase.from('account_module_permissions').select('module,can_view,can_edit,can_approve').eq('account_id', ctx.accountId).eq('user_id', userId).order('module');
    if (error) throw error;
    return NextResponse.json({ permissions: data ?? [] });
  } catch (error) { return toErrorResponse(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const ctx = await requireRole('admin');
    const { userId } = await params;
    const body = await request.json().catch(() => null) as { permissions?: unknown } | null;
    if (!Array.isArray(body?.permissions)) return NextResponse.json({ error: 'permissions must be an array' }, { status: 400 });
    const rows = body.permissions.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const value = item as { module?: unknown; can_view?: unknown; can_edit?: unknown; can_approve?: unknown };
      if (typeof value.module !== 'string' || !(MODULES as readonly string[]).includes(value.module)) return [];
      const normalized = normalizePermission(value.module as PermissionModule, { can_view: Boolean(value.can_view), can_edit: Boolean(value.can_edit), can_approve: Boolean(value.can_approve) });
      return [{ account_id: ctx.accountId, user_id: userId, ...normalized, updated_at: new Date().toISOString() }];
    });
    const { error } = await ctx.supabase.from('account_module_permissions').upsert(rows, { onConflict: 'account_id,user_id,module' });
    if (error) throw error;
    return NextResponse.json({ ok: true, permissions: rows });
  } catch (error) { return toErrorResponse(error); }
}
