'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot, ExternalLink, Loader2, Plus, Search, ShieldCheck } from 'lucide-react';
import { getResearchBaseCatalog } from '@/lib/consulting/research-catalog';

type Project = { id: string; name: string; objective?: string | null };
type Source = { id: string; title: string; source_type: string; reference?: string | null; excerpt: string; created_at: string };
type Artifact = { id: string; title: string; artifact_type: string; status: string; version: number; content: Record<string, unknown>; created_at: string };
const box = 'rounded-2xl border border-border bg-card p-5';
const catalog = getResearchBaseCatalog();

export default function ResearchCenterPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ title: '', source_type: 'website', reference: '', excerpt: '' });

  const loadProjectData = useCallback(async (id: string) => {
    if (!id) return;
    const [sourceResponse, artifactResponse] = await Promise.all([
      fetch(`/api/consulting/projects/${id}/research-sources`, { cache: 'no-store' }),
      fetch(`/api/consulting/projects/${id}/artifacts`, { cache: 'no-store' }),
    ]);
    const sourceBody = await sourceResponse.json().catch(() => null) as { data?: Source[]; error?: string } | null;
    const artifactBody = await artifactResponse.json().catch(() => null) as { data?: Artifact[]; error?: string } | null;
    if (!sourceResponse.ok || !artifactResponse.ok) {
      setMessage(sourceBody?.error ?? artifactBody?.error ?? 'Não foi possível carregar o projeto.');
      return;
    }
    setSources(sourceBody?.data ?? []);
    setArtifacts(artifactBody?.data ?? []);
  }, []);

  useEffect(() => {
    void fetch('/api/consulting/projects', { cache: 'no-store' })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) as { data?: Project[]; error?: string } | null }))
      .then(({ response, body }) => {
        if (!response.ok) return setMessage(body?.error ?? 'Não foi possível carregar projetos.');
        const loaded = body?.data ?? [];
        setProjects(loaded);
        if (loaded[0]) {
          setProjectId(loaded[0].id);
          void loadProjectData(loaded[0].id);
        }
      });
  }, [loadProjectData]);

  async function saveSource(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    setBusy(true); setMessage('');
    const response = await fetch(`/api/consulting/projects/${projectId}/research-sources`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) setMessage(body?.error ?? 'Não foi possível salvar a fonte.');
    else {
      setForm({ title: '', source_type: 'website', reference: '', excerpt: '' });
      setMessage('Fonte salva e disponível para a próxima pesquisa.');
      await loadProjectData(projectId);
    }
    setBusy(false);
  }

  async function runResearch() {
    setBusy(true); setMessage('');
    const queued = await fetch(`/api/consulting/projects/${projectId}/executions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { trigger: 'research_center', agent_key: 'research-benchmark-v1' }, idempotency_key: crypto.randomUUID() }),
    });
    const queuedBody = await queued.json().catch(() => null) as { data?: { id?: string }; error?: string } | null;
    if (!queued.ok || !queuedBody?.data?.id) {
      setMessage(queuedBody?.error ?? 'Não foi possível enfileirar a pesquisa.'); setBusy(false); return;
    }
    const executed = await fetch(`/api/consulting/executions/${queuedBody.data.id}/run`, { method: 'POST' });
    const body = await executed.json().catch(() => null) as { error?: string } | null;
    setMessage(executed.ok ? 'Pesquisa gerada e enviada para revisão humana.' : (body?.error ?? 'A pesquisa falhou.'));
    if (executed.ok) await loadProjectData(projectId);
    setBusy(false);
  }

  const researchArtifacts = artifacts.filter((item) => item.artifact_type === 'market_research');
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <Link href="/commercial/strategy" className="text-muted-foreground inline-flex items-center gap-2 text-sm"><ArrowLeft className="h-4 w-4" /> Voltar ao centro estratégico</Link>
    <header className={box}><div className="flex items-start gap-3"><Search className="text-primary mt-1 h-7 w-7" /><div><p className="text-primary text-sm font-medium">Metodologia operacional</p><h1 className="mt-1 text-2xl font-bold">Centro de Pesquisa e Benchmark</h1><p className="text-muted-foreground mt-2 text-sm">Consulte a pesquisa-base, registre evidências autorizadas e gere a análise personalizada do projeto.</p></div></div><p className="bg-primary/5 text-muted-foreground mt-5 flex gap-2 rounded-xl p-4 text-xs"><ShieldCheck className="text-primary h-4 w-4 shrink-0" /> Não registre senhas, tokens, cookies, dados clínicos ou dados pessoais sensíveis.</p></header>
    {message && <p className="border-border bg-muted/30 rounded-xl border p-4 text-sm">{message}</p>}
    <section className={box}><label className="text-sm font-semibold">Projeto ativo<select value={projectId} onChange={(event) => { setProjectId(event.target.value); void loadProjectData(event.target.value); }} className="border-input bg-background mt-2 h-10 w-full rounded-md border px-3"><option value="">Selecione um projeto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label></section>
    <section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Biblioteca de pesquisas-base</h2><span className="text-muted-foreground text-xs">versão {catalog.version}</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{catalog.modules.map((module) => <article key={module.key} className={box}><p className="text-primary text-xs font-semibold uppercase">{module.key}</p><h3 className="mt-2 font-semibold">{module.title}</h3><p className="text-muted-foreground mt-2 text-sm">{module.objective}</p><p className="mt-3 text-xs font-medium">Evidências necessárias</p><ul className="text-muted-foreground mt-1 list-disc pl-4 text-xs">{module.requiredEvidence.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-3 text-xs font-medium">Saídas: <span className="text-muted-foreground font-normal">{module.outputs.join(' · ')}</span></p></article>)}</div></section>
    <section className="grid gap-6 lg:grid-cols-2"><form onSubmit={saveSource} className={box}><h2 className="flex items-center gap-2 font-semibold"><Plus className="text-primary h-5 w-5" /> Adicionar fonte autorizada</h2><div className="mt-4 grid gap-3"><input required maxLength={240} placeholder="Título da fonte" value={form.title} onChange={(e) => setForm((old) => ({ ...old, title: e.target.value }))} className="border-input bg-background h-10 rounded-md border px-3 text-sm" /><div className="grid gap-3 sm:grid-cols-2"><select value={form.source_type} onChange={(e) => setForm((old) => ({ ...old, source_type: e.target.value }))} className="border-input bg-background h-10 rounded-md border px-3 text-sm"><option value="website">Site</option><option value="ad">Anúncio</option><option value="proposal">Proposta</option><option value="interview">Entrevista</option><option value="transcript">Transcrição</option><option value="report">Relatório</option><option value="internal">Interna</option><option value="other">Outra</option></select><input maxLength={1000} placeholder="URL ou referência" value={form.reference} onChange={(e) => setForm((old) => ({ ...old, reference: e.target.value }))} className="border-input bg-background h-10 rounded-md border px-3 text-sm" /></div><textarea required maxLength={4000} rows={7} placeholder="Trecho observado, sem informações sensíveis" value={form.excerpt} onChange={(e) => setForm((old) => ({ ...old, excerpt: e.target.value }))} className="border-input bg-background rounded-md border p-3 text-sm" /><button disabled={busy || !projectId} className="bg-primary text-primary-foreground inline-flex h-10 w-fit items-center gap-2 rounded-md px-4 text-sm font-medium disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Salvar fonte</button></div></form>
    <section className={box}><div className="flex items-center justify-between"><h2 className="font-semibold">Fontes do projeto</h2><span className="text-muted-foreground text-xs">{sources.length} ativa(s)</span></div><div className="mt-4 space-y-3">{sources.length ? sources.map((source) => <article key={source.id} className="bg-muted/40 rounded-xl p-3"><p className="text-sm font-semibold">{source.title}</p><p className="text-primary mt-1 text-xs">{source.source_type}</p><p className="text-muted-foreground mt-2 line-clamp-3 text-xs">{source.excerpt}</p>{source.reference && /^https?:\/\//i.test(source.reference) ? <a href={source.reference} target="_blank" rel="noreferrer" className="text-primary mt-2 inline-flex items-center gap-1 text-xs">Abrir referência <ExternalLink className="h-3 w-3" /></a> : source.reference ? <p className="text-muted-foreground mt-2 text-xs">Referência: {source.reference}</p> : null}</article>) : <p className="text-muted-foreground text-sm">Nenhuma fonte cadastrada.</p>}</div><button onClick={() => void runResearch()} disabled={busy || !projectId} className="border-input mt-4 inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium disabled:opacity-50"><Bot className="h-4 w-4" /> Gerar pesquisa personalizada</button></section></section>
    <section className={box}><div className="flex items-center justify-between"><h2 className="font-semibold">Pesquisas geradas</h2><Link href="/commercial/review" className="text-primary text-sm">Abrir fila de revisão</Link></div><div className="mt-4 space-y-3">{researchArtifacts.length ? researchArtifacts.map((artifact) => <details key={artifact.id} className="border-border rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold">{artifact.title} · {artifact.status} · v{artifact.version}</summary><pre className="bg-muted/40 mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg p-3 text-xs">{JSON.stringify(artifact.content, null, 2)}</pre></details>) : <p className="text-muted-foreground text-sm">Nenhuma pesquisa gerada para este projeto.</p>}</div></section>
    <section className="border-primary/20 bg-primary/5 rounded-2xl border p-5">
      <h2 className="font-semibold">Tutorial rápido: como usar o Centro de Pesquisa</h2>
      <ol className="text-muted-foreground mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <li><strong className="text-foreground">1. Prepare o projeto.</strong> Crie o projeto, execute o diagnóstico e aprove o plano estratégico na <Link href="/commercial/review" className="text-primary underline">fila de revisão</Link>.</li>
        <li><strong className="text-foreground">2. Selecione o projeto.</strong> Escolha acima a empresa que receberá a pesquisa personalizada.</li>
        <li><strong className="text-foreground">3. Cadastre evidências.</strong> Adicione sites, anúncios, propostas, entrevistas ou relatórios autorizados. Registre apenas o trecho relevante.</li>
        <li><strong className="text-foreground">4. Gere a pesquisa.</strong> Clique em <em>Gerar pesquisa personalizada</em>. O agente usará somente o plano aprovado e as fontes desse projeto.</li>
        <li><strong className="text-foreground">5. Confira o resultado.</strong> Abra a pesquisa gerada, verifique observações, fontes, limitações e evidências ausentes.</li>
        <li><strong className="text-foreground">6. Aprove ou solicite ajustes.</strong> Tome a decisão na fila de revisão antes de usar a pesquisa em ICP, persona, posicionamento ou oferta.</li>
      </ol>
      <p className="text-muted-foreground mt-4 text-xs">Dica: use fontes diferentes para confirmar uma conclusão. Sem fontes suficientes, o sistema mantém a lacuna visível em vez de inventar informações.</p>
    </section>
  </main>;
}
