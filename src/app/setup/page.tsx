"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Database, Globe, KeyRound, Server } from "lucide-react";

type Form = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  domain: string;
  encryptionKey: string;
  metaAppSecret: string;
  instagramAppSecret: string;
  ryzeApiUrl: string;
  ryzeApiAdminToken: string;
  googleCalendarClientId: string;
  googleCalendarClientSecret: string;
  googleCalendarRedirectUri: string;
};
type Result = { ok: boolean; checks: { key: string; label: string; ok: boolean; message: string }[] } | null;

export default function SetupPage() {
  const [form, setForm] = useState<Form>({ supabaseUrl: "", supabaseAnonKey: "", supabaseServiceKey: "", domain: "", encryptionKey: "", metaAppSecret: "", instagramAppSecret: "", ryzeApiUrl: "", ryzeApiAdminToken: "", googleCalendarClientId: "", googleCalendarClientSecret: "", googleCalendarRedirectUri: "" });
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const set = (key: keyof Form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  async function validate() { setLoading(true); const response = await fetch("/api/setup/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); setResult(await response.json()); setLoading(false); }
  const StatusIcon = result?.ok ? CheckCircle2 : CircleAlert;
  return <main className="min-h-screen bg-muted/30 p-4 sm:p-10"><div className="mx-auto max-w-3xl space-y-6"><header className="rounded-2xl border border-border bg-card p-6"><p className="text-sm font-medium text-primary">WACRM Setup</p><h1 className="mt-1 text-2xl font-bold">Configure sua instalação</h1><p className="mt-2 text-sm text-muted-foreground">O instalador verifica os dados antes de gerar a configuração. Nesta etapa, nada é gravado no GitHub ou no banco.</p></header><section className="rounded-2xl border border-border bg-card p-6"><SectionTitle icon={Database} title="Supabase" /><div className="mt-4 grid gap-4"><Field label="URL do projeto" value={form.supabaseUrl} onChange={(v) => set("supabaseUrl", v)} placeholder="https://seu-projeto.supabase.co" /><Field label="Anon key" value={form.supabaseAnonKey} onChange={(v) => set("supabaseAnonKey", v)} secret /><Field label="Service role key" value={form.supabaseServiceKey} onChange={(v) => set("supabaseServiceKey", v)} secret /></div></section><section className="rounded-2xl border border-border bg-card p-6"><SectionTitle icon={Server} title="Segurança e Meta" /><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Encryption key (64 hex)" value={form.encryptionKey} onChange={(v) => set("encryptionKey", v)} secret /><Field label="Meta App Secret (opcional)" value={form.metaAppSecret} onChange={(v) => set("metaAppSecret", v)} secret /><Field label="Instagram App Secret (opcional)" value={form.instagramAppSecret} onChange={(v) => set("instagramAppSecret", v)} secret /></div></section><section className="rounded-2xl border border-border bg-card p-6"><SectionTitle icon={Server} title="WhatsApp via RyzeAPI (opcional)" /><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="URL do RyzeAPI" value={form.ryzeApiUrl} onChange={(v) => set("ryzeApiUrl", v)} placeholder="https://seu-ryzeapi.example" /><Field label="Token administrativo" value={form.ryzeApiAdminToken} onChange={(v) => set("ryzeApiAdminToken", v)} secret /></div></section><section className="rounded-2xl border border-border bg-card p-6"><SectionTitle icon={Globe} title="Google Calendar (opcional)" /><div className="mt-4 grid gap-4"><Field label="Client ID" value={form.googleCalendarClientId} onChange={(v) => set("googleCalendarClientId", v)} placeholder="...apps.googleusercontent.com" /><Field label="Client Secret" value={form.googleCalendarClientSecret} onChange={(v) => set("googleCalendarClientSecret", v)} secret /><Field label="Redirect URI" value={form.googleCalendarRedirectUri} onChange={(v) => set("googleCalendarRedirectUri", v)} placeholder="https://crm.seudominio.com.br/api/calendar/callback" /></div></section><section className="rounded-2xl border border-border bg-card p-6"><SectionTitle icon={Globe} title="Endereço público" /><div className="mt-4"><Field label="Domínio ou URL pública" value={form.domain} onChange={(v) => set("domain", v)} placeholder="https://crm.suaempresa.com.br" /></div></section><button onClick={validate} disabled={loading} className="h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">{loading ? "Verificando…" : "Verificar configuração"}</button>{result && <section className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center gap-2"><StatusIcon className={`h-5 w-5 ${result.ok ? "text-emerald-600" : "text-amber-600"}`} /><h2 className="font-semibold">{result.ok ? "Configuração pronta para o próximo passo" : "Ainda há itens para corrigir"}</h2></div><div className="mt-4 space-y-2">{result.checks.map((check) => <div key={check.key} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3 text-sm"><span className={check.ok ? "text-emerald-600" : "text-amber-600"}>{check.ok ? "✓" : "!"}</span><div><p className="font-medium">{check.label}</p><p className="text-xs text-muted-foreground">{check.message}</p></div></div>)}</div></section>}</div></main>;
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Database; title: string }) { return <div className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /><h2 className="font-semibold">{title}</h2></div>; }
function Field({ label, value, onChange, placeholder, secret }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; secret?: boolean }) { return <label className="grid gap-2 text-sm font-medium">{label}<input className="h-10 rounded-md border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary/30" type={secret ? "password" : "text"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" /></label>; }
