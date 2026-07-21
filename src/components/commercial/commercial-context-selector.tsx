"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, ExternalLink, Loader2 } from "lucide-react";

type Project = { id: string; name: string; status?: string | null; current_phase?: string | null };
const STORAGE_KEY = "consulting_active_project";

/** Global account/project context shared by commercial, strategy and marketing screens. */
export function CommercialContextSelector() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/consulting/projects")
      .then((response) => response.ok ? response.json() : { data: [] })
      .then((body: { data?: Project[] }) => {
        if (cancelled) return;
        const active = (body.data ?? []).filter((project) => project.status !== "archived");
        setProjects(active);
        const saved = window.localStorage.getItem(STORAGE_KEY);
        const next = saved && active.some((project) => project.id === saved) ? saved : active[0]?.id ?? "";
        setSelectedId(next);
        if (next) window.localStorage.setItem(STORAGE_KEY, next);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function select(id: string) {
    setSelectedId(id);
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("consulting-project-changed", { detail: { projectId: id } }));
  }

  const selected = projects.find((project) => project.id === selectedId);
  return <section className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-2"><Building2 className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Empresa/projeto em uso</p><p className="truncate text-xs text-muted-foreground">{selected ? `${selected.name}${selected.current_phase ? ` · ${selected.current_phase}` : ""}` : "Selecione um projeto para não misturar dados"}</p></div></div>
    <div className="flex items-center gap-2"><label className="sr-only" htmlFor="commercial-context-selector">Selecionar empresa ou projeto</label><select id="commercial-context-selector" value={selectedId} onChange={(event) => select(event.target.value)} disabled={loading} className="h-9 min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-xs sm:w-64">{loading ? <option value="">Carregando empresas…</option> : projects.length ? <><option value="">Selecione uma empresa/projeto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</> : <option value="">Nenhuma empresa cadastrada</option>}</select>{loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}<Link href="/commercial/projects" title="Gerenciar empresas e projetos" className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs hover:bg-muted"><ExternalLink className="h-3 w-3" /><span className="hidden sm:inline">Gerenciar</span></Link></div>
  </section>;
}
