export type Playbook = {
  id: string;
  name: string;
  trigger: string;
  objective: string;
  steps: string[];
  guardrail: string;
  priority: "alta" | "média" | "baixa";
};

export const COMMERCIAL_PLAYBOOKS: Playbook[] = [
  { id: "new-lead", name: "Novo interessado", trigger: "Lead recebido em WhatsApp ou Instagram", objective: "Responder rápido, registrar origem e conduzir para pré-qualificação.", steps: ["Criar contato e negócio", "Classificar serviço e intenção", "Enviar resposta aprovada", "Definir próxima ação e prazo"], guardrail: "Perguntas clínicas devem ser encaminhadas a um profissional.", priority: "alta" },
  { id: "appointment", name: "Avaliação agendada", trigger: "Negócio movido para avaliação agendada", objective: "Reduzir no-show e garantir confirmação humana quando necessário.", steps: ["Enviar confirmação", "Lembrar 24h antes", "Solicitar confirmação", "Escalar ausência de resposta"], guardrail: "Não prometer resultado clínico ou diagnóstico por mensagem.", priority: "alta" },
  { id: "post-plan", name: "Plano apresentado", trigger: "Plano apresentado sem decisão", objective: "Acompanhar a decisão sem pressão e registrar objeções reais.", steps: ["Registrar objeção", "Enviar conteúdo aprovado", "Criar follow-up com data", "Encerrar ou reciclar com motivo"], guardrail: "Respeitar consentimento e interromper mensagens após opt-out.", priority: "alta" },
  { id: "no-show", name: "Recuperação de no-show", trigger: "Atendimento marcado como no-show", objective: "Recuperar a oportunidade com linguagem acolhedora e nova agenda.", steps: ["Registrar motivo se informado", "Enviar mensagem de recuperação", "Oferecer nova janela", "Escalar casos sensíveis"], guardrail: "Não coletar histórico clínico no CRM comercial.", priority: "média" },
  { id: "won-handoff", name: "Handoff para entrega", trigger: "Negócio ganho", objective: "Garantir que a entrega receba contexto comercial suficiente e seguro.", steps: ["Marcar handoff pendente", "Revisar oferta contratada", "Notificar responsável", "Confirmar conclusão"], guardrail: "Enviar somente contexto comercial autorizado.", priority: "média" },
];

export function recommendPlaybooks(scores: Record<string, number> = {}) {
  const ordered = Object.entries(scores).sort(([, a], [, b]) => a - b);
  const names = new Set<string>();
  if ((scores.Atendimento ?? 100) < 70) names.add("new-lead");
  if ((scores.Aquisição ?? 100) < 70 || (scores.Oferta ?? 100) < 70) names.add("post-plan");
  if ((scores.Processo ?? 100) < 70) names.add("appointment");
  if ((scores.Atendimento ?? 100) < 50) names.add("no-show");
  if ((scores.Governança ?? 100) < 70) names.add("won-handoff");
  if (!names.size && ordered.length) names.add("new-lead");
  return COMMERCIAL_PLAYBOOKS.filter((playbook) => names.has(playbook.id));
}
