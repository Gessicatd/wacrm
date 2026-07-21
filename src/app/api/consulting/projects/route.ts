import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { createProject, listProjects, validateProjectInput } from "@/lib/consulting";

export async function GET() {
  try {
    const ctx = await requireRole("viewer");
    const { data, error } = await listProjects(ctx.supabase, ctx.accountId);
    if (error) { console.error("[consulting/projects] list", error); return NextResponse.json({ error: "Failed to list consulting projects" }, { status: 500 }); }
    return NextResponse.json({ data: data ?? [] });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const input = validateProjectInput(await request.json().catch(() => null));
    const { data, error } = await createProject(ctx.supabase, ctx.accountId, ctx.userId, input);
    if (error) { console.error("[consulting/projects] create", error); return NextResponse.json({ error: "Failed to create consulting project" }, { status: 500 }); }
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /required|maximum|must be/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    return toErrorResponse(error);
  }
}
