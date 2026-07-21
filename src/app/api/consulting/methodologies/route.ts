import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { validateMethodologyInput } from "@/lib/consulting";

export async function GET() {
  try { const ctx = await requireRole("viewer"); const { data, error } = await ctx.supabase.from("consulting_methodologies").select("*").eq("account_id", ctx.accountId).is("deleted_at", null).order("created_at", { ascending: false }); if (error) return NextResponse.json({ error: "Failed to list methodologies" }, { status: 500 }); return NextResponse.json({ data: data ?? [] }); } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try { const ctx = await requireRole("admin"); const input = validateMethodologyInput(await request.json().catch(() => null)); const { data, error } = await ctx.supabase.from("consulting_methodologies").insert({ account_id: ctx.accountId, created_by: ctx.userId, name: input.name, description: input.description ?? null, source_type: input.sourceType ?? null, source_reference: input.sourceReference ?? null, status: "draft", version: 1 }).select().single(); if (error) return NextResponse.json({ error: "Failed to create methodology" }, { status: 500 }); return NextResponse.json({ data }, { status: 201 }); } catch (error) { if (error instanceof Error && /required|maximum/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 }); return toErrorResponse(error); }
}
