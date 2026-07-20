export const ONBOARDING_OPTIONS = {
  specialty: ["Clínica de estética", "Médico(a) focado(a) em beleza", "Odontologia", "Outro serviço high-ticket"],
  ticket: ["Até R$ 3 mil", "R$ 3 mil a R$ 10 mil", "R$ 10 mil a R$ 30 mil", "Acima de R$ 30 mil"],
  salesPath: ["WhatsApp", "Instagram", "Indicação", "Múltiplos canais sem processo único"],
  responseTime: ["Até 5 minutos", "Até 1 hora", "No mesmo dia", "Não sei medir"],
  followup: ["Mandamos uma mensagem depois", "Ligamos ou fazemos uma nova tentativa", "Tentamos algumas vezes, sem padrão fixo", "Não fazemos nada depois"],
  priority: ["Gerar mais oportunidades", "Converter melhor os leads", "Reduzir perda por demora", "Organizar a equipe"],
  consent: ["Temos processo documentado", "Fazemos caso a caso", "Ainda não temos clareza"],
  awareness: ["Ainda não reconhece o problema", "Reconhece o problema, mas não a solução", "Compara soluções", "Pronto para decidir"],
  funnelType: ["Não sei qual é", "Captação e conversa", "Quiz e conversa", "Aplicação ou conversa de vendas", "Múltiplas rotas"],
  research: ["Fazemos com método", "Fazemos informalmente", "Não fazemos", "Não sei responder"],
  callProcess: ["Não fazemos essa conversa", "Fazemos por telefone ou vídeo", "Fazemos pelo WhatsApp", "Fazemos, mas sem roteiro"],
};

export type OnboardingOptionKey = keyof typeof ONBOARDING_OPTIONS;
