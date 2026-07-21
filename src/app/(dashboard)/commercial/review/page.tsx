'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { QuickTutorial } from '@/components/commercial/quick-tutorial';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

type ReviewItem = {
  id: string;
  title: string;
  artifact_type: string;
  version: number;
  created_at: string;
  content: Record<string, unknown>;
  project: {
    name: string;
    objective?: string | null;
    current_phase?: string | null;
  } | null;
  execution: {
    status: string;
    model_used?: string | null;
    evidence?: Evidence[];
    output?: { tools?: ToolLog[] };
  } | null;
  reviews: {
    id: string;
    decision: string;
    feedback?: string | null;
    created_at: string;
  }[];
  events: {
    id: string;
    event_type: string;
    from_status?: string | null;
    to_status?: string | null;
    created_at: string;
  }[];
};
type Evidence = {
  kind: string;
  source: string;
  summary: string;
  confidence: number;
  limitations?: string[];
  requires_human_review?: boolean;
};
type ToolLog = { tool: string; status: string; summary: string };

const box = 'rounded-2xl border border-border bg-card p-5';

export default function ConsultingReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const response = await fetch('/api/consulting/review-queue', {
      cache: 'no-store',
    });
    const body = (await response.json().catch(() => null)) as {
      data?: ReviewItem[];
      error?: string;
    } | null;
    if (!response.ok)
      setError(body?.error ?? 'Não foi possível carregar a fila de revisão.');
    else setItems(body?.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/consulting/review-queue', { cache: 'no-store' })
      .then(async (response) => ({
        response,
        body: (await response.json().catch(() => null)) as {
          data?: ReviewItem[];
          error?: string;
        } | null,
      }))
      .then(({ response, body }) => {
        if (!active) return;
        if (!response.ok)
          setError(
            body?.error ?? 'Não foi possível carregar a fila de revisão.'
          );
        else setItems(body?.data ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function decide(
    id: string,
    decision: 'approved' | 'changes_requested'
  ) {
    const note = feedback[id]?.trim() ?? '';
    if (decision === 'changes_requested' && !note) {
      setError('Descreva o que precisa mudar antes de devolver o artefato.');
      return;
    }
    setSubmitting(id);
    setError('');
    const response = await fetch(`/api/consulting/artifacts/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, feedback: note }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok)
      setError(body?.error ?? 'Não foi possível registrar a decisão.');
    else await load();
    setSubmitting(null);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <Link
        href="/commercial/strategy"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao centro estratégico
      </Link>
      <header className={box}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <FileCheck2 className="text-primary mt-1 h-7 w-7" />
            <div>
              <p className="text-primary text-sm font-medium">
                Controle humano obrigatório
              </p>
              <h1 className="mt-1 text-2xl font-bold">
                Fila de revisão estratégica
              </h1>
              <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
                Agentes podem analisar e propor. Somente um administrador pode
                aprovar um artefato. Evidências, ferramentas e transições
                permanecem visíveis para auditoria.
              </p>
            </div>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="border-input inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
      </header>
      {error && (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-4 text-sm">
          {error}
        </p>
      )}
      {loading ? (
        <section className={box}>
          <p className="text-muted-foreground text-sm">
            Carregando fila de revisão…
          </p>
        </section>
      ) : !items.length ? (
        <section className={box}>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="font-semibold">
                Nenhum artefato aguardando decisão
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                A fila permanecerá vazia até uma execução real gerar um artefato
                em revisão.
              </p>
            </div>
          </div>
        </section>
      ) : (
        items.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            note={feedback[item.id] ?? ''}
            busy={submitting === item.id}
            onNote={(value) =>
              setFeedback((old) => ({ ...old, [item.id]: value }))
            }
            onDecision={(decision) => void decide(item.id, decision)}
          />
        ))
      )}
      <QuickTutorial
        title="Como revisar um artefato"
        steps={[
          'Leia o conteúdo completo e confirme se o projeto e a versão estão corretos.',
          'Confira ferramentas, evidências, confiança e limitações registradas pelo agente.',
          'Aprove somente quando as conclusões estiverem sustentadas pelas fontes.',
          'Se houver lacunas, descreva o ajuste necessário e solicite mudanças.',
        ]}
        note="A aprovação libera o artefato para alimentar as próximas etapas da metodologia."
      />
    </main>
  );
}

function ReviewCard({
  item,
  note,
  busy,
  onNote,
  onDecision,
}: {
  item: ReviewItem;
  note: string;
  busy: boolean;
  onNote: (value: string) => void;
  onDecision: (decision: 'approved' | 'changes_requested') => void;
}) {
  const evidence = Array.isArray(item.execution?.evidence)
    ? item.execution.evidence
    : [];
  const tools = Array.isArray(item.execution?.output?.tools)
    ? item.execution.output.tools
    : [];
  return (
    <article className={box}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-primary text-xs font-semibold tracking-wide uppercase">
            {item.project?.name ?? 'Projeto'} · versão {item.version}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{item.title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {item.project?.objective ?? 'Objetivo não informado'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
          <Clock3 className="h-3.5 w-3.5" /> Em revisão
        </span>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="bg-muted/40 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Bot className="text-primary h-4 w-4" />
            <h3 className="text-sm font-semibold">Ferramentas executadas</h3>
          </div>
          <div className="mt-3 space-y-2">
            {tools.length ? (
              tools.map((tool) => (
                <div key={tool.tool} className="text-xs">
                  <strong>{tool.tool}</strong> · {tool.status}
                  <p className="text-muted-foreground mt-0.5">{tool.summary}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-xs">
                Sem logs de ferramentas.
              </p>
            )}
          </div>
        </section>
        <section className="bg-muted/40 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary h-4 w-4" />
            <h3 className="text-sm font-semibold">Evidências e limites</h3>
          </div>
          <div className="mt-3 space-y-3">
            {evidence.length ? (
              evidence.map((entry, index) => (
                <div key={`${entry.source}-${index}`} className="text-xs">
                  <p>
                    <strong>{entry.kind}</strong> · {entry.source} · confiança{' '}
                    {Math.round(entry.confidence * 100)}%
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {entry.summary}
                  </p>
                  {entry.limitations?.map((limit) => (
                    <p key={limit} className="mt-1 text-amber-700">
                      • {limit}
                    </p>
                  ))}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-xs">
                Sem evidências estruturadas.
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="border-border mt-4 rounded-xl border p-4">
        <h3 className="text-sm font-semibold">Conteúdo completo do artefato</h3>
        <pre className="bg-muted/40 mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg p-3 text-xs">
          {JSON.stringify(item.content, null, 2)}
        </pre>
      </section>
      <section className="border-border mt-4 rounded-xl border p-4">
        <h3 className="text-sm font-semibold">Trilha de estados</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.events.map((event) => (
            <span
              key={event.id}
              className="bg-muted rounded-full px-3 py-1 text-xs"
            >
              {event.from_status ? `${event.from_status} → ` : ''}
              {event.to_status ?? event.event_type}
            </span>
          ))}
        </div>
      </section>
      <label className="mt-5 block text-sm font-medium">
        Parecer ou ajustes solicitados
        <textarea
          value={note}
          onChange={(event) => onNote(event.target.value)}
          maxLength={5000}
          rows={4}
          placeholder="Registre evidências verificadas, correções ou justificativa da aprovação."
          className="border-input bg-background focus:ring-ring mt-2 w-full rounded-md border p-3 text-sm outline-none focus:ring-2"
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={() => onDecision('approved')}
          disabled={busy}
          className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" /> Aprovar artefato
        </button>
        <button
          onClick={() => onDecision('changes_requested')}
          disabled={busy}
          className="border-input inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" /> Solicitar mudanças
        </button>
      </div>
    </article>
  );
}
