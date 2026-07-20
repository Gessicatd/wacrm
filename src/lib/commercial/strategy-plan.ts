type Json = Record<string, unknown>;

export type StrategyPriority = { rank: number; dimension: string; problem: string; objective: string; actions: string[]; metric: string };
export type StrategyStage = { name: string; purpose: string; entryEvidence: string; exitEvidence: string; owner: string; sla: string };
export type StrategyPlan = {
  title: string;
  executiveSummary: string;
  methodologyBasis: string[];
  businessDiagnosis: { context: string; baseline: string[]; constraints: string[]; unknowns: string[] };
  positioning: { specialty: string; offer: string; audience: string; promise: string; differentiator: string };
  market: { researchStatus: string; questions: string[]; awareness: string; benchmarkInputs: string[]; decision: string };
  offerArchitecture: { transformation: string; mechanism: string; proof: string[]; scope: string[]; exclusions: string[]; nextStep: string };
  priorities: StrategyPriority[];
  funnel: { stages: string[]; firstAction: string; handoff: string; stagesDetail: StrategyStage[] };
  acquisition: { channels: string[]; asset: string; creativeBrief: string[]; campaignRule: string; metrics: string[]; budgetNote: string };
  commercialProcess: { roles: string[]; cadence: string[]; callStructure: string[]; objections: string[]; handoff: string[] };
  ninetyDays: { period: string; objective: string; actions: string[]; acceptance: string }[];
  indicators: string[];
  governance: { approvals: string[]; automations: string[]; compliance: string[] };
  evidenceNeeded: string[];
  version: string;
};

const DIMENSIONS: Record<string, { problem: string; objective: string; actions: string[]; metric: string }> = {
  Estratégia: { problem: "A direção comercial ainda não está suficientemente documentada.", objective: "Definir público, oferta prioritária e meta de 90 dias.", actions: ["Registrar cliente ideal e critérios de desqualificação", "Escolher uma oferta principal para o funil", "Documentar promessa e diferenciais verificáveis"], metric: "Oferta e público aprovados" },
  Oferta: { problem: "A oferta pode estar difícil de explicar ou comparar.", objective: "Tornar a proposta clara antes de aumentar o tráfego.", actions: ["Especificar transformação, escopo e limites", "Definir prova, condições e próximos passos", "Testar a mensagem em conversas reais"], metric: "Taxa de avanço após apresentação" },
  Aquisição: { problem: "A origem dos leads e o percurso até a conversa não estão totalmente visíveis.", objective: "Instrumentar a entrada e o primeiro avanço do lead.", actions: ["Padronizar origem, campanha e UTM", "Definir uma rota principal de captação", "Registrar o evento de primeiro contato"], metric: "Leads identificados por origem" },
  Atendimento: { problem: "A velocidade ou a consistência do atendimento pode estar reduzindo conversões.", objective: "Criar uma rotina de resposta, qualificação e follow-up.", actions: ["Definir SLA de primeira resposta", "Criar roteiro de qualificação", "Ativar follow-up com consentimento e próxima ação"], metric: "Tempo de resposta e taxa de contato" },
  Processo: { problem: "A equipe ainda pode não ter uma fonte única de verdade para acompanhar oportunidades.", objective: "Fazer cada oportunidade ter etapa, responsável e próxima ação.", actions: ["Definir campos obrigatórios", "Configurar etapas e critérios de avanço", "Criar revisão semanal de perdas e gargalos"], metric: "Oportunidades com próxima ação" },
  Governança: { problem: "Os limites de automação e o consentimento ainda precisam de validação.", objective: "Escalar sem mensagens indevidas ou decisões sem supervisão.", actions: ["Documentar consentimento e opt-out", "Separar sugestão, aprovação e automação", "Registrar ações e encaminhamentos humanos"], metric: "Ações auditáveis e consentimento conhecido" },
};

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

export function buildStrategyPlan(profile: Json | null, assessment: Json | null): StrategyPlan {
  const answers = (assessment?.answers as Json | undefined) ?? {};
  const scores = (assessment?.dimension_scores as Json | undefined) ?? {};
  const ordered = Object.entries(scores).filter(([, score]) => typeof score === "number").sort(([, a], [, b]) => Number(a) - Number(b)).slice(0, 3);
  const priorities = ordered.map(([dimension], index) => { const base = DIMENSIONS[dimension] ?? DIMENSIONS.Processo; return { rank: index + 1, dimension, ...base }; });
  const specialty = text(profile?.specialty) ?? text(answers.specialty) ?? "serviço high-ticket";
  const offer = text(profile?.primary_offer) ?? text(answers.mainOffer) ?? "oferta prioritária";
  const audience = text((profile?.ideal_customer_profile as Json | undefined)?.description) ?? text(answers.idealCustomer) ?? "cliente ideal a validar";
  const goal = text(profile?.target_90_days) ?? text(answers.goal) ?? "organizar e aumentar a conversão comercial";
  const differentiator = text(answers.differentiator) ?? "diferencial a comprovar com pesquisa e conversas reais";
  const awareness = text(answers.awareness) ?? "nível de consciência a validar";
  const researchStatus = text(answers.research) ?? "não informado";
  const channel = text(answers.salesPath) ?? "canal principal a definir";
  const stages = ["Novo lead", "Contato iniciado", "Qualificado", "Conversa agendada", "Proposta/apresentação", "Ganho, perda ou reciclagem"];
  const stagesDetail: StrategyStage[] = [
    { name: stages[0], purpose: "Registrar origem e consentimento.", entryEvidence: "Lead recebido com canal e data.", exitEvidence: "Primeira tentativa registrada.", owner: "Atendimento/SDR", sla: "Definir no diagnóstico" },
    { name: stages[1], purpose: "Abrir conversa e entender contexto.", entryEvidence: "Mensagem ou ligação realizada.", exitEvidence: "Necessidade e próximo passo registrados.", owner: "Atendimento/SDR", sla: "Definir no diagnóstico" },
    { name: stages[2], purpose: "Confirmar aderência, urgência e capacidade.", entryEvidence: "Critérios mínimos preenchidos.", exitEvidence: "Apto para conversa ou reciclado.", owner: "SDR/closer", sla: "Definir no diagnóstico" },
    { name: stages[3], purpose: "Conduzir a conversa de decisão.", entryEvidence: "Horário confirmado.", exitEvidence: "Comparecimento ou motivo de falta.", owner: "Closer", sla: "Definir no diagnóstico" },
    { name: stages[4], purpose: "Apresentar solução, prova, escopo e condições.", entryEvidence: "Necessidade validada.", exitEvidence: "Decisão, objeção ou próxima ação.", owner: "Closer", sla: "Definir no diagnóstico" },
    { name: stages[5], purpose: "Fechar, reciclar ou registrar perda com motivo.", entryEvidence: "Decisão comunicada.", exitEvidence: "Handoff ou cadência de reciclagem criada.", owner: "Closer/gestor", sla: "Definir no diagnóstico" },
  ];
  return {
    title: `Plano estratégico comercial — ${specialty}`,
    executiveSummary: `O projeto organiza ${offer}, o percurso do ${audience} e a próxima ação de cada oportunidade. A metodologia recomenda clareza de oferta, pesquisa de público, funil qualificatório, processo comercial alinhado e otimização por evidência antes de ampliar investimento. Meta declarada para 90 dias: ${goal}.`,
    methodologyBasis: ["Briefing e levantamento de dados do cliente", "Pesquisa de mercado e benchmarking", "Definição de público, produto/serviço e funil", "Oferta, promessa, provas e mecanismo", "Estratégia de tráfego, criativos, processo comercial e métricas"],
    businessDiagnosis: { context: `Segmento informado: ${specialty}. Oferta em foco: ${offer}.`, baseline: [`Canal informado: ${channel}`, `Nível de consciência informado: ${awareness}`, `Pesquisa de mercado: ${researchStatus}`], constraints: ["Capacidade de entrega", "Orçamento e maturidade de tráfego", "Equipe e tempo de resposta", "Regras de comunicação aplicáveis"], unknowns: ["Números reais dos últimos 90 dias", "Conversas ganhas e perdidas", "Concorrentes e criativos", "Margem, ciclo e capacidade mensais"] },
    positioning: { specialty, offer, audience, promise: `Ajudar ${audience} a avançar com clareza até uma conversa de venda de ${offer}, sem depender de respostas improvisadas.`, differentiator },
    market: { researchStatus, questions: ["O que a concorrência comunica?", "Para quem ela fala e em qual nível de consciência?", "Como chama atenção e apresenta a promessa?", "Que provas, CTA e falhas aparecem?", "O que pode ser melhorado sem copiar?"], awareness, benchmarkInputs: ["Anúncios e criativos", "Promessas e mecanismos", "Oferta, prova e CTA", "Pontos fracos e oportunidades", "Referências de outros nichos"], decision: "Nenhuma decisão de oferta ou tráfego deve ser tratada como validada sem evidência registrada." },
    offerArchitecture: { transformation: `Transformação principal de ${offer} para ${audience} — validar com prova real.`, mechanism: "Mecanismo único e pilares da solução a definir a partir da pesquisa e da experiência do negócio.", proof: ["Cases e depoimentos autorizados", "Resultados e evidências verificáveis", "Demonstração do processo"], scope: ["Estratégia e posicionamento", "Funil e percurso comercial", "Mensagens, provas e próximos passos", "Orientação de tráfego e métricas", "Treinamento e handoff conforme contrato"], exclusions: ["Gestão contínua de mídia, salvo contratação específica", "Promessas clínicas ou garantias de resultado", "Manutenção fora do período contratado"], nextStep: "Agendar conversa de diagnóstico ou apresentar a proposta aprovada." },
    priorities,
    funnel: { stages, firstAction: "Registrar origem, oferta de interesse e consentimento antes da primeira automação.", handoff: "Quando houver intenção clínica, reclamação ou dúvida fora da base comercial, encaminhar para humano.", stagesDetail },
    acquisition: { channels: [channel, "Indicação e networking", "Meta/Instagram", "Google quando houver intenção de busca"], asset: "Rota de qualificação adequada ao público: conteúdo/presell, quiz ou aplicação e conversa.", creativeBrief: ["Público específico", "Um problema principal", "Promessa e mecanismo claros", "Prova ou credibilidade", "CTA com ganho concreto"], campaignRule: "Testar criativos com orçamento compatível com o volume; escalar apenas quando oferta, criativo e capacidade comercial suportarem a demanda.", metrics: ["Custo por lead qualificado", "Taxa de contato", "Taxa de agendamento", "Comparecimento", "Conversão e receita por origem"], budgetNote: "Orçamento não informado; não inventar valor. Definir após linha de base e capacidade." },
    commercialProcess: { roles: ["Proprietário/gestor aprova estratégia, oferta e limites.", "SDR/atendimento registra, qualifica e agenda.", "Closer conduz diagnóstico, proposta e fechamento.", "Entrega/sucesso recebe o handoff completo."], cadence: ["Resposta inicial dentro do SLA aprovado", "Cadência de follow-up com consentimento", "Revisão semanal do pipeline", "Retrospectiva mensal de conversão e perdas"], callStructure: ["Ouvir contexto e objetivo", "Aprofundar problema e impacto", "Confirmar aderência e critérios", "Apresentar solução e prova", "Tratar objeções", "Definir decisão e próximo passo"], objections: ["Preço", "Tempo", "Confiança/prova", "Prioridade", "Comparação com alternativa"], handoff: ["Registrar promessa, escopo, condições e restrições", "Entregar contexto sem dados clínicos", "Definir responsável e primeiro contato", "Confirmar expectativas com o cliente"] },
    ninetyDays: [
      { period: "Dias 1–30 · Diagnosticar e organizar", objective: "Construir a linha de base e a estratégia.", actions: ["Completar briefing", "Pesquisar público e concorrência", "Definir oferta, promessa, provas e desqualificadores", "Configurar funil, campos, origem e consentimento"], acceptance: "Plano revisado e funil desenhado." },
      { period: "Dias 31–60 · Estruturar e testar", objective: "Colocar a operação para repetir o processo.", actions: ["Publicar páginas, quiz ou aplicação conforme rota", "Criar criativos e mensagens", "Treinar atendimento e fechamento", "Ativar cadência, alertas e playbooks em modo supervisionado"], acceptance: "Primeiras oportunidades acompanhadas com evidência." },
      { period: "Dias 61–90 · Otimizar e decidir", objective: "Melhorar conversão sem escalar desperdício.", actions: ["Comparar canais e campanhas", "Revisar objeções e motivos de perda", "Ajustar oferta, criativos, SLAs e etapas", "Definir escala, manutenção ou novo teste"], acceptance: "Revisão com indicadores e decisões documentadas." },
    ],
    indicators: ["Tempo até primeira resposta", "Taxa de contato", "Taxa de qualificação", "Agendamentos e comparecimento", "Conversão por etapa", "Motivos de perda", "Receita e custo por origem", "Oportunidades com próxima ação"],
    governance: { approvals: ["Proprietário aprova oferta, preço, promessa e escopo", "Responsável técnico aprova comunicações sensíveis", "Humano aprova mensagens externas antes da ativação"], automations: ["IA sugere; não decide sozinha", "Automação cuida de tarefa repetitiva e alertas", "Dúvidas clínicas, reclamações e exceções vão para humano"], compliance: ["Registrar consentimento e opt-out", "Não armazenar dados clínicos no CRM comercial", "Manter trilha de auditoria e prazo de retenção"] },
    evidenceNeeded: ["Exportação do CRM", "Cinco conversas ganhas e cinco perdidas", "Números dos últimos 90 dias", "Proposta e mensagens atuais", "Pesquisa de concorrentes e criativos", "Capacidade, margem e ciclo de venda"],
    version: "v2.0 · metodologia estruturada · revisão humana necessária",
  };
}
