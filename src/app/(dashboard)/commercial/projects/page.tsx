'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { QuickTutorial } from '@/components/commercial/quick-tutorial';
import {
  ArrowLeft,
  Bot,
  BriefcaseBusiness,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

type Project = {
  id: string;
  name: string;
  objective: string | null;
  status: string;
  current_phase: string | null;
  target_end_date: string | null;
};
const box = 'rounded-2xl border border-border bg-card p-5';

export default function ConsultingProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    objective: '',
    scope: '',
    target_end_date: '',
  });

  const load = useCallback(async () => {
    const response = await fetch('/api/consulting/projects', {
      cache: 'no-store',
    });
    const body = (await response.json().catch(() => null)) as {
      data?: Project[];
      error?: string;
    } | null;
    if (response.ok) {
      const loaded = body?.data ?? [];
      setProjects(loaded);
      const saved = window.localStorage.getItem('consulting_active_project');
      setSelectedProjectId(
        loaded.some((project) => project.id === saved)
          ? saved
          : (loaded[0]?.id ?? null)
      );
    }
    else setMessage(body?.error ?? 'Não foi possível carregar os projetos.');
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/consulting/projects', { cache: 'no-store' })
      .then(async (response) => ({
        response,
        body: (await response.json().catch(() => null)) as {
          data?: Project[];
          error?: string;
        } | null,
      }))
      .then(({ response, body }) => {
        if (!active) return;
        if (response.ok) {
          const loaded = body?.data ?? [];
          setProjects(loaded);
          const saved = window.localStorage.getItem(
            'consulting_active_project'
          );
          setSelectedProjectId(
            loaded.some((project) => project.id === saved)
              ? saved
              : (loaded[0]?.id ?? null)
          );
        }
        else
          setMessage(body?.error ?? 'Não foi possível carregar os projetos.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const response = await fetch('/api/consulting/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        target_end_date: form.target_end_date || null,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok)
      setMessage(body?.error ?? 'Não foi possível criar o projeto.');
    else {
      setForm({ name: '', objective: '', scope: '', target_end_date: '' });
      setMessage('Projeto criado em rascunho.');
      await load();
    }
    setSaving(false);
  }

  async function runAgent(
    projectId: string,
    agentKey: 'diagnosis-strategy-v1' | 'research-benchmark-v1'
  ) {
    setRunning(projectId);
    setMessage('');
    const queued = await fetch(
      `/api/consulting/projects/${projectId}/executions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { trigger: 'manual_reviewed', agent_key: agentKey, sources: [] },
          idempotency_key: crypto.randomUUID(),
        }),
      }
    );
    const body = (await queued.json().catch(() => null)) as {
      data?: { id?: string };
      error?: string;
    } | null;
    if (!queued.ok || !body?.data?.id) {
      setMessage(body?.error ?? 'Não foi possível enfileirar o agente.');
      setRunning(null);
      return;
    }
    const executed = await fetch(
      `/api/consulting/executions/${body.data.id}/run`,
      { method: 'POST' }
    );
    const result = (await executed.json().catch(() => null)) as {
      error?: string;
    } | null;
    setMessage(
      executed.ok
        ? 'Análise concluída e enviada para revisão humana.'
        : (result?.error ?? 'A execução do agente falhou.')
    );
    setRunning(null);
  }

  function selectProject(projectId: string) {
    setSelectedProjectId(projectId);
    window.localStorage.setItem('consulting_active_project', projectId);
    setMessage('Empresa/projeto selecionado para a operação.');
  }

  async function archiveProject(project: Project) {
    const confirmed = window.confirm(
      `Remover “${project.name}” da operação? O projeto será arquivado com seu histórico preservado.`
    );
    if (!confirmed) return;
    setRunning(project.id);
    setMessage('');
    const response = await fetch(`/api/consulting/projects/${project.id}`, {
      method: 'DELETE',
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) {
      setMessage(body?.error ?? 'Não foi possível remover o projeto.');
    } else {
      if (selectedProjectId === project.id)
        window.localStorage.removeItem('consulting_active_project');
      setMessage('Projeto arquivado e removido da lista. O histórico foi preservado.');
      await load();
    }
    setRunning(null);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <Link
        href="/commercial/strategy"
        className="text-muted-foreground inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao centro estratégico
      </Link>
      <header className={box}>
        <div className="flex items-start gap-3">
          <BriefcaseBusiness className="text-primary mt-1 h-7 w-7" />
          <div>
            <p className="text-primary text-sm font-medium">
              Operação da consultoria
            </p>
            <h1 className="mt-1 text-2xl font-bold">Projetos estratégicos</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Cada iniciativa é isolada por conta. Agentes propõem; humanos
              aprovam.
            </p>
          </div>
        </div>
        <p className="bg-primary/5 text-muted-foreground mt-5 flex gap-2 rounded-xl p-4 text-xs">
          <ShieldCheck className="text-primary h-4 w-4 shrink-0" /> Não inclua
          credenciais, dados clínicos ou informações pessoais sensíveis.
        </p>
      </header>
      {message && (
        <p className="border-border bg-muted/30 rounded-xl border p-4 text-sm">
          {message}
        </p>
      )}
      <section className={box}>
        <h2 className="flex items-center gap-2 font-semibold">
          <Plus className="text-primary h-5 w-5" /> Novo projeto
        </h2>
        <form onSubmit={createProject} className="mt-4 grid gap-4">
          <label className="text-sm font-medium">
            Nome
            <input
              required
              maxLength={160}
              value={form.name}
              onChange={(event) =>
                setForm((old) => ({ ...old, name: event.target.value }))
              }
              className="border-input bg-background mt-2 h-10 w-full rounded-md border px-3"
            />
          </label>
          <label className="text-sm font-medium">
            Objetivo
            <textarea
              required
              maxLength={5000}
              rows={3}
              value={form.objective}
              onChange={(event) =>
                setForm((old) => ({ ...old, objective: event.target.value }))
              }
              className="border-input bg-background mt-2 w-full rounded-md border p-3"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Escopo inicial
              <textarea
                maxLength={10000}
                rows={3}
                value={form.scope}
                onChange={(event) =>
                  setForm((old) => ({ ...old, scope: event.target.value }))
                }
                className="border-input bg-background mt-2 w-full rounded-md border p-3"
              />
            </label>
            <label className="text-sm font-medium">
              Data-alvo
              <input
                type="date"
                value={form.target_end_date}
                onChange={(event) =>
                  setForm((old) => ({
                    ...old,
                    target_end_date: event.target.value,
                  }))
                }
                className="border-input bg-background mt-2 h-10 w-full rounded-md border px-3"
              />
            </label>
          </div>
          <button
            disabled={saving}
            className="bg-primary text-primary-foreground inline-flex h-10 w-fit items-center gap-2 rounded-md px-4 text-sm font-medium disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}{' '}
            Criar projeto
          </button>
        </form>
      </section>
      <section className="space-y-3">
        <div className="flex justify-between">
          <h2 className="font-semibold">Projetos existentes</h2>
          <Link href="/commercial/review" className="text-primary text-sm">
            Fila de revisão
          </Link>
        </div>
        {loading ? (
          <div className={box}>Carregando…</div>
        ) : !projects.length ? (
          <div className={box}>
            <p className="text-muted-foreground text-sm">
              Nenhum projeto. Cadastre apenas uma iniciativa real e autorizada.
            </p>
          </div>
        ) : (
          projects.map((project) => (
            <article
              key={project.id}
              className={`${box} ${selectedProjectId === project.id ? 'border-primary ring-primary/20 ring-2' : ''}`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-primary mt-1 text-xs">
                    {project.status} · {project.current_phase ?? 'intake'}
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {project.objective}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                <button
                  onClick={() => selectProject(project.id)}
                  className="border-input inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {selectedProjectId === project.id ? 'Selecionado' : 'Selecionar'}
                </button>
                <button
                  onClick={() =>
                    void runAgent(project.id, 'diagnosis-strategy-v1')
                  }
                  disabled={running === project.id}
                  className="border-input inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                >
                  {running === project.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}{' '}
                  Executar diagnóstico
                </button>
                <button
                  onClick={() =>
                    void runAgent(project.id, 'research-benchmark-v1')
                  }
                  disabled={running === project.id}
                  className="border-input inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                >
                  <Bot className="h-4 w-4" /> Preparar pesquisa-base
                </button>
                <button
                  onClick={() => void archiveProject(project)}
                  disabled={running === project.id}
                  className="border-destructive/30 text-destructive inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Remover
                </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
      <QuickTutorial
        title="Como operar os projetos"
        steps={[
          'Crie um projeto para cada empresa ou iniciativa, com objetivo e escopo claros.',
          'Execute o diagnóstico para gerar o primeiro plano estratégico em revisão.',
          'Abra a fila de revisão, confira evidências e aprove ou solicite ajustes.',
          'Depois da aprovação, prepare a pesquisa e acompanhe os próximos artefatos.',
        ]}
        note="Não misture empresas no mesmo projeto e nunca registre credenciais ou dados sensíveis nos campos livres."
      />
    </main>
  );
}
