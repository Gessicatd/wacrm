import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";

export async function GET() {
  try {
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase.from("consulting_agent_definitions").select("*").eq("account_id", ctx.accountId).neq("status", "archived").order("name");
    if (error) return NextResponse.json({ error: "Failed to list agent definitions" }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
    const required = ["agent_key", "name", "role", "objective"];
    if (required.some((key) => typeof body[key] !== "string" || !(body[key] as string).trim())) return NextResponse.json({ error: "agent_key, name, role and objective are required" }, { status: 400 });
    const { data, error } = await ctx.supabase.from("consulting_agent_definitions").insert({ account_id: ctx.accountId, agent_key: (body.agent_key as string).trim(), name: (body.name as string).trim(), role: (body.role as string).trim(), objective: (body.objective as string).trim(), instructions: typeof body.instructions === "string" ? body.instructions : "", allowed_tools: Array.isArray(body.allowed_tools) ? body.allowed_tools : [], required_inputs: Array.isArray(body.required_inputs) ? body.required_inputs : [], expected_output_schema: body.expected_output_schema && typeof body.expected_output_schema === "object" ? body.expected_output_schema : {}, validation_rules: Array.isArray(body.validation_rules) ? body.validation_rules : [], model_configuration: body.model_configuration && typeof body.model_configuration === "object" ? body.model_configuration : {}, status: "draft" }).select().single();
    if (error) return NextResponse.json({ error: "Failed to create agent definition" }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}
