import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";

export async function GET() {
  try {
    const ctx = await requireRole("admin");
    const { data, error } = await ctx.supabase.from("commercial_strategy_plans").select("*").eq("account_id", ctx.accountId).order("version", { ascending: false }).limit(10);
    if (error) throw error;
    return NextResponse.json({ plans: data ?? [] });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null) as { plan?: unknown; assessment_id?: string | null; status?: string } | null;
    if (!body?.plan || typeof body.plan !== "object") return NextResponse.json({ error: "plan is required" }, { status: 400 });
    const { data: latest } = await ctx.supabase.from("commercial_strategy_plans").select("version").eq("account_id", ctx.accountId).order("version", { ascending: false }).limit(1).maybeSingle();
    const nextVersion = (typeof latest?.version === "number" ? latest.version : 0) + 1;
    const { data, error } = await ctx.supabase.from("commercial_strategy_plans").insert({ account_id: ctx.accountId, assessment_id: body.assessment_id ?? null, version: nextVersion, status: body.status === "in_review" ? "in_review" : "draft", plan: body.plan, created_by: ctx.userId }).select().single();
    if (error) throw error;
    return NextResponse.json({ plan: data }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}
