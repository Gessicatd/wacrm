import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateProjectInput } from "./types";

export async function listProjects(db: SupabaseClient, accountId: string) {
  return db.from("consulting_projects").select("*").eq("account_id", accountId).is("deleted_at", null).order("created_at", { ascending: false });
}

export async function createProject(db: SupabaseClient, accountId: string, userId: string, input: CreateProjectInput) {
  return db.from("consulting_projects").insert({
    account_id: accountId,
    created_by: userId,
    name: input.name,
    objective: input.objective,
    scope: input.scope ? { description: input.scope } : {},
    methodology_id: input.methodologyId ?? null,
    target_end_date: input.targetEndDate ?? null,
    status: "draft",
    current_phase: "intake",
  }).select().single();
}
