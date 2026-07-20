export type AgentAutonomy = "suggest" | "approved_execution" | "automatic";
export type AgentStatus = "draft" | "ready" | "active" | "paused";

export type CommercialAgent = {
  key: string;
  name: string;
  description: string;
  purpose: string;
  status: AgentStatus;
  autonomy: AgentAutonomy;
  knowledge: string[];
  tools: string[];
  approval: string;
  nextStep: string;
};

export const COMMERCIAL_AGENTS: CommercialAgent[] = [
  { key: "diagnosis", name: "Agente de diagnóstico", description: "Interpreta o questionário e a transcrição da call para encontrar gargalos e prioridades.", purpose: "Gerar uma leitura confiável da operação antes de recomendar mudanças.", status: "ready", autonomy: "suggest", knowledge: ["metodologia", "diagnóstico", "transcrições"], tools: ["ler onboarding", "comparar evidências", "gerar relatório"], approval: "O relatório deve ser revisado antes de ser apresentado ao cliente.", nextStep: "Ligar a transcrição da call ao diagnóstico." },
  { key: "strategy", name: "Agente de planejamento", description: "Converte o diagnóstico em plano comercial, prioridades e ações de 30, 60 e 90 dias.", purpose: "Tornar o planejamento estratégico uma entrega repetível e adaptável.", status: "draft", autonomy: "suggest", knowledge: ["metodologia", "playbooks", "diagnóstico"], tools: ["montar plano", "sugerir indicadores", "mapear dependências"], approval: "Nenhum plano é enviado ou ativado sem aprovação do consultor.", nextStep: "Criar o template mestre do plano estratégico." },
  { key: "inbox", name: "Agente de atendimento", description: "Classifica a intenção do lead, sugere a próxima pergunta e identifica quando chamar uma pessoa.", purpose: "Reduzir tempo de resposta sem tirar o controle da equipe.", status: "ready", autonomy: "approved_execution", knowledge: ["oferta", "playbooks", "objeções"], tools: ["classificar lead", "aplicar tag", "sugerir resposta"], approval: "Questões clínicas, reclamações e dúvidas fora da base exigem humano.", nextStep: "Conectar a classificação às tags e ao inbox." },
  { key: "follow-up", name: "Agente de follow-up", description: "Encontra oportunidades paradas e recomenda o próximo contato permitido.", purpose: "Evitar que oportunidades qualificadas desapareçam por falta de acompanhamento.", status: "draft", autonomy: "approved_execution", knowledge: ["playbooks", "objeções", "pipeline"], tools: ["encontrar leads parados", "criar tarefa", "propor mensagem"], approval: "A mensagem deve respeitar consentimento e regras da conta.", nextStep: "Definir SLAs e playbooks por etapa." },
  { key: "campaigns", name: "Agente de campanhas", description: "Relaciona origem, campanha, custo e conversão para apontar onde o funil perde eficiência.", purpose: "Transformar mídia em decisão comercial, e não apenas em volume de leads.", status: "draft", autonomy: "suggest", knowledge: ["atribuição", "indicadores", "funil"], tools: ["ler campanhas", "comparar conversão", "gerar alerta"], approval: "Recomendações de investimento não são executadas automaticamente.", nextStep: "Aplicar migration e conectar contas autorizadas." },
  { key: "operations", name: "Agente de operação", description: "Resume tarefas atrasadas, riscos do funil e prioridades da equipe.", purpose: "Dar ao gestor uma visão diária clara do que precisa ser resolvido.", status: "draft", autonomy: "suggest", knowledge: ["CRM", "indicadores", "regras comerciais"], tools: ["resumir exceções", "criar checklist", "alertar responsável"], approval: "Alertas podem ser automáticos; mudanças de dados permanecem auditáveis.", nextStep: "Definir o painel operacional diário." },
];

export function canAutoExecute(agent: CommercialAgent, action: string) {
  if (agent.autonomy !== "automatic") return false;
  return !["alterar preço", "apagar dados", "responder reclamação", "decisão clínica", "publicar campanha"].includes(action);
}

export function agentReadiness(agent: CommercialAgent) {
  if (agent.status === "active") return "Ativo";
  if (agent.status === "ready") return "Pronto para validação";
  return "Em preparação";
}
