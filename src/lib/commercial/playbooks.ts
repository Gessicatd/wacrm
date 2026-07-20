export type Playbook = {
  id: string;
  name: string;
  trigger: string;
  objective: string;
  steps: string[];
  guardrail: string;
  priority: "alta" | "média" | "baixa";
  owner: string;
  sla: string;
  requiredFields: string[];
  decisionPoints: string[];
  exampleMessage: string;
  exitCriteria: string[];
  metrics: string[];
  automationTemplate?: string;
};

export const COMMERCIAL_PLAYBOOKS: Playbook[] = [
  { id: "new-lead", name: "Novo interessado", trigger: "Lead recebido em WhatsApp ou Instagram", objective: "Responder rápido, registrar origem e conduzir para pré-qualificação.", steps: ["Criar contato e negócio", "Classificar serviço e intenção", "Enviar resposta aprovada", "Definir próxima ação e prazo"], guardrail: "Perguntas clínicas devem ser encaminhadas a um profissional.", priority: "alta", owner: "Recepção ou pré-vendas", sla: "Primeira resposta em até 5 minutos no horário de atendimento", requiredFields: ["Nome", "Canal e campanha de origem", "Serviço de interesse", "Objetivo declarado", "Consentimento para contato"], decisionPoints: ["Se houver urgência clínica, encaminhar para atendimento humano", "Se o serviço e objetivo estiverem claros, oferecer avaliação", "Se faltar informação, fazer no máximo duas perguntas por vez"], exampleMessage: "Olá, {nome}! Recebi seu interesse em {serviço}. Para eu te orientar corretamente, qual resultado você gostaria de alcançar e prefere falar por aqui ou agendar uma avaliação?", exitCriteria: ["Avaliação agendada", "Lead desqualificado com motivo", "Sem resposta após a cadência aprovada"], metrics: ["Tempo até primeira resposta", "Taxa de qualificação", "Agendamentos por origem"], automationTemplate: "health_lead_intake" },
  { id: "appointment", name: "Avaliação agendada", trigger: "Negócio movido para avaliação agendada", objective: "Reduzir no-show e garantir confirmação humana quando necessário.", steps: ["Enviar confirmação", "Lembrar 24h antes", "Solicitar confirmação", "Escalar ausência de resposta"], guardrail: "Não prometer resultado clínico ou diagnóstico por mensagem.", priority: "alta", owner: "Recepção", sla: "Confirmação imediata e lembrete 24 horas antes", requiredFields: ["Data e horário", "Profissional ou unidade", "Serviço", "Canal de confirmação"], decisionPoints: ["Se confirmar, manter agendamento", "Se pedir alteração, oferecer horários sem criar novo cadastro", "Se não responder, criar tarefa de ligação"], exampleMessage: "Olá, {nome}! Sua avaliação de {serviço} está reservada para {data} às {hora}. Responda CONFIRMAR para manter ou ALTERAR para escolher outro horário.", exitCriteria: ["Compareceu", "Remarcou", "Cancelou", "No-show registrado"], metrics: ["Taxa de confirmação", "Taxa de comparecimento", "Remarcações"], automationTemplate: "appointment_confirmation" },
  { id: "post-plan", name: "Plano apresentado", trigger: "Plano apresentado sem decisão", objective: "Acompanhar a decisão sem pressão e registrar objeções reais.", steps: ["Registrar objeção", "Enviar conteúdo aprovado", "Criar follow-up com data", "Encerrar ou reciclar com motivo"], guardrail: "Respeitar consentimento e interromper mensagens após opt-out.", priority: "alta", owner: "Consultor ou vendedor responsável", sla: "Primeiro follow-up em 24 horas; no máximo três tentativas na cadência", requiredFields: ["Oferta apresentada", "Valor e condição", "Objeção principal", "Data combinada para retorno"], decisionPoints: ["Se a objeção for financeira, esclarecer escopo e condição aprovada", "Se for insegurança, oferecer prova social autorizada ou nova conversa", "Se não houver intenção, encerrar sem insistência"], exampleMessage: "{nome}, depois da nossa conversa, ficou alguma dúvida sobre o plano ou sobre o próximo passo? Posso esclarecer o ponto que mais pesou na sua decisão.", exitCriteria: ["Fechou", "Perdido com motivo", "Reciclagem com data definida", "Opt-out"], metrics: ["Conversão após apresentação", "Motivos de perda", "Tempo até decisão"], automationTemplate: "plan_follow_up" },
  { id: "no-show", name: "Recuperação de no-show", trigger: "Atendimento marcado como no-show", objective: "Recuperar a oportunidade com linguagem acolhedora e nova agenda.", steps: ["Registrar motivo se informado", "Enviar mensagem de recuperação", "Oferecer nova janela", "Escalar casos sensíveis"], guardrail: "Não coletar histórico clínico no CRM comercial.", priority: "média", owner: "Recepção", sla: "Contato no mesmo dia, após confirmar que não houve atendimento", requiredFields: ["Agendamento original", "Status de comparecimento", "Motivo comercial se informado", "Tentativas realizadas"], decisionPoints: ["Se houve imprevisto, oferecer remarcação", "Se demonstrar desinteresse, encerrar com respeito", "Se relatar questão clínica, transferir para profissional"], exampleMessage: "Olá, {nome}. Sentimos sua falta hoje. Se ainda fizer sentido para você, posso verificar dois novos horários para sua avaliação.", exitCriteria: ["Remarcou", "Recusou", "Sem resposta após cadência", "Encaminhado ao humano"], metrics: ["Taxa de recuperação", "Tempo até remarcação", "Motivos de no-show" ] },
  { id: "won-handoff", name: "Handoff para entrega", trigger: "Negócio ganho", objective: "Garantir que a entrega receba contexto comercial suficiente e seguro.", steps: ["Marcar handoff pendente", "Revisar oferta contratada", "Notificar responsável", "Confirmar conclusão"], guardrail: "Enviar somente contexto comercial autorizado.", priority: "média", owner: "Vendedor e responsável pela entrega", sla: "Handoff concluído no mesmo dia da venda", requiredFields: ["Oferta contratada", "Condição comercial", "Responsável pela entrega", "Próximo compromisso", "Consentimentos registrados"], decisionPoints: ["Se faltar informação essencial, bloquear a entrega e solicitar correção", "Se estiver completo, notificar responsável", "Nunca incluir diagnóstico ou dado clínico no resumo comercial"], exampleMessage: "Venda confirmada para {nome}. Oferta: {oferta}. Próximo passo: {proximo_passo}. Responsável: {responsavel}. Confira os campos antes de iniciar.", exitCriteria: ["Recebido pela equipe", "Primeiro contato de entrega realizado", "Pendência devolvida ao vendedor"], metrics: ["Tempo até primeiro contato", "Handoffs devolvidos", "Cancelamentos pós-venda" ] },
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
