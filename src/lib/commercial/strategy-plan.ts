type Json = Record<string, unknown>;

export type StrategyPriority = { rank: number; dimension: string; problem: string; objective: string; actions: string[]; metric: string };
export type StrategyPlan = {
  title: string;
  executiveSummary: string;
  positioning: { specialty: string; offer: string; audience: string; promise: string };
  priorities: StrategyPriority[];
  ninetyDays: { period: string; objective: string; actions: string[] }[];
  funnel: { stages: string[]; firstAction: string; handoff: string };
  indicators: string[];
  evidenceNeeded: string[];
  version: string;
};

const DIMENSIONS: Record<string, { problem: string; objective: string; actions: string[]; metric: string }> = {
  Estratégia: { problem: "A direção comercial ainda não está suficientemente documentada.", objective: "Definir público, oferta prioritária e meta de 90 dias.", actions: ["Registrar cliente ideal e critérios de desqualificação", "Escolher uma oferta principal para o funil", "Documentar promessa e diferenciais verificáveis"], metric: "Oferta e público aprovados" },
  Oferta: { problem: "A oferta pode estar difícil de explicar ou comparar.", objective: "Tornar a proposta clara antes de aumentar o tráfego.", actions: ["Especificar transformação, escopo e limites", "Definir prova, condições e próximos passos", "Testar a mensagem em conversas reais"], metric: "Taxa de avanço após apresentação" },
  Aquisição: { problem: "A origem dos leads e o percurso até a conversa não estão totalmente visíveis.", objective: "Instrumentar a entrada e o primeiro avanço do lead.", actions: ["Padronizar origem, campanha e UTM", "Definir uma rota principal de captação", "Registrar o evento de primeiro contato"], metric: "Leads identificados por origem" },
  Atendimento: { problem: "A velocidade ou a consistência do atendimento pode estar reduzindo conversões.", objective: "Criar uma rotina de resposta, qualificação e follow-up.", actions: ["Definir SLA de primeira resposta", "Criar roteiro de qualificação", "Ativar follow-up com consentimento e próxima ação"], metric: "Tempo de resposta e taxa de contato" },
  Processo: { problem: "A equipe ainda pode não ter uma fonte única de verdade para acompanhar oportunidades.", objective: "Fazer cada oportunidade ter etapa, responsável e próxima ação.", actions: ["Definir campos obrigatórios", "Configurar etapas e critérios de avanço", "Criar revisão semanal de perdas e gargalos"], metric: "Oportunidades com próxima ação" },
  Governança: { problem: "Os limites de automação e o consentimento ainda precisam de validação.", objective: "Escalar sem expor a empresa a mensagens indevidas ou decisões sem supervisão.", actions: ["Documentar consentimento e opt-out", "Separar sugestão, aprovação e automação", "Registrar ações e encaminhamentos humanos"], metric: "Ações auditáveis e consentimento conhecido" },
};

export function buildStrategyPlan(profile: Json | null, assessment: Json | null): StrategyPlan {
  const answers = (assessment?.answers as Json | undefined) ?? {};
  const scores = (assessment?.dimension_scores as Json | undefined) ?? {};
  const ordered = Object.entries(scores).filter(([, score]) => typeof score === "number").sort(([, a], [, b]) => Number(a) - Number(b)).slice(0, 3);
  const priorities = ordered.map(([dimension], index) => {
    const base = DIMENSIONS[dimension] ?? DIMENSIONS.Processo;
    return { rank: index + 1, dimension, ...base };
  });
  const specialty = text(profile?.specialty) ?? text(answers.specialty) ?? "serviço high-ticket";
  const offer = text(profile?.primary_offer) ?? text(answers.mainOffer) ?? "oferta prioritária";
  const audience = text((profile?.ideal_customer_profile as Json | undefined)?.description) ?? text(answers.idealCustomer) ?? "cliente ideal a validar";
  const goal = text(profile?.target_90_days) ?? text(answers.goal) ?? "organizar e aumentar a conversão comercial";
  return {
    title: `Plano estratégico comercial — ${specialty}`,
    executiveSummary: `A operação deve primeiro organizar ${offer}, o percurso do ${audience} e a próxima ação de cada oportunidade. O plano prioriza evidências e consistência antes de ampliar investimento. Meta declarada para 90 dias: ${goal}.`,
    positioning: { specialty, offer, audience, promise: `Ajudar ${audience} a avançar com clareza até uma conversa de venda de ${offer}, sem depender de respostas improvisadas.` },
    priorities,
    ninetyDays: [
      { period: "Dias 1–30 · Organizar", objective: "Criar uma fonte única de verdade.", actions: ["Revisar oferta e cliente ideal", "Configurar etapas, campos, origem e consentimento", "Definir primeira resposta e próxima ação"] },
      { period: "Dias 31–60 · Padronizar", objective: "Fazer a equipe repetir o que funciona.", actions: ["Publicar playbooks de atendimento e follow-up", "Treinar critérios de avanço e perda", "Ligar alertas de oportunidades paradas"] },
      { period: "Dias 61–90 · Otimizar", objective: "Decidir com base em conversão e não em volume.", actions: ["Comparar canais e campanhas", "Revisar objeções e motivos de perda", "Ajustar oferta, mensagens e SLAs"] },
    ],
    funnel: { stages: ["Novo lead", "Contato iniciado", "Qualificado", "Conversa agendada", "Proposta/apresentação", "Ganho ou reciclagem"], firstAction: "Registrar origem, oferta de interesse e consentimento antes da primeira automação.", handoff: "Quando houver intenção clínica, reclamação ou dúvida fora da base comercial, encaminhar para humano." },
    indicators: ["Tempo até primeira resposta", "Taxa de contato", "Taxa de qualificação", "Agendamentos e comparecimento", "Conversão por etapa", "Motivos de perda", "Receita por origem"],
    evidenceNeeded: ["Conversas ganhas e perdidas", "Investimento e campanhas por origem", "Taxa de comparecimento", "Objeções recorrentes", "Capacidade real de atendimento"],
    version: "v1.0 · rascunho determinístico",
  };
}

function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
