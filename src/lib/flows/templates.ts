/**
 * Starter flow templates.
 *
 * Three pre-canned flows users can clone with one click instead of
 * building from scratch. Each template is a plain JS object describing
 * the same shape `/api/flows` PUT accepts — name, trigger config,
 * entry_node_id, fallback_policy, nodes[] — keyed by a stable
 * `slug`.
 *
 * The clone path (`/api/flows` POST with `template_slug`) creates a
 * NEW flow_row + flow_nodes rows for the user. `node_key`s are kept
 * verbatim (they're stable strings, not UUIDs, so cloning never
 * needs to rewrite edge references).
 *
 * Choosing a single static module over a DB-backed gallery for v1
 * because: (a) the set is small and changes with code releases, not
 * data; (b) keeps templates portable across self-hosted instances
 * without migrations; (c) editing in source is the lowest-friction
 * way to add the next template.
 */

import type {
  AiConditionNodeConfig,
  AiExtractNodeConfig,
  CollectInputNodeConfig,
  ConditionNodeConfig,
  HandoffNodeConfig,
  KeywordTriggerConfig,
  SendButtonsNodeConfig,
  SendListNodeConfig,
  SendMessageNodeConfig,
  StartNodeConfig,
} from "./types";

export type FlowTemplateNodeType =
  | "start"
  | "send_message"
  | "send_buttons"
  | "send_list"
  | "collect_input"
  | "condition"
  | "ai_condition"
  | "ai_extract"
  | "set_tag"
  | "handoff"
  | "end";

export interface FlowTemplateNode {
  node_key: string;
  node_type: FlowTemplateNodeType;
  config:
    | StartNodeConfig
    | SendMessageNodeConfig
    | SendButtonsNodeConfig
    | SendListNodeConfig
    | CollectInputNodeConfig
    | ConditionNodeConfig
    | AiConditionNodeConfig
    | AiExtractNodeConfig
    | HandoffNodeConfig
    | Record<string, unknown>;
}

export interface FlowTemplate {
  slug: string;
  name: string;
  description: string;
  /** Used by the gallery to surface a relevant icon. lucide-react name. */
  icon: "MessageSquare" | "HelpCircle" | "UserPlus";
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: KeywordTriggerConfig | Record<string, unknown>;
  entry_node_id: string;
  nodes: FlowTemplateNode[];
}

// ============================================================
// 1. Welcome menu — the example from the owner's brief
// ============================================================
const WELCOME_MENU: FlowTemplate = {
  slug: "welcome_menu",
  name: "Welcome menu",
  description:
    "Greet customers who type a keyword and route them to the right agent based on whether they're new or existing.",
  icon: "MessageSquare",
  trigger_type: "keyword",
  trigger_config: { keywords: ["support", "help", "hi"], match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome" },
    },
    {
      node_key: "welcome",
      node_type: "send_buttons",
      config: {
        text: "Hi! 👋 Welcome to support. Are you an existing customer or new here?",
        footer_text: "Tap a button below to continue.",
        buttons: [
          {
            reply_id: "existing",
            title: "Existing customer",
            next_node_key: "existing_handoff",
          },
          {
            reply_id: "new",
            title: "New customer",
            next_node_key: "new_handoff",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "existing_handoff",
      node_type: "handoff",
      config: {
        note: "Existing customer needs assistance — please check account history before replying.",
      } as HandoffNodeConfig,
    },
    {
      node_key: "new_handoff",
      node_type: "handoff",
      config: {
        note: "New customer — share pricing + onboarding link.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 2. FAQ bot — list-message answers, fully automated
// ============================================================
const FAQ_BOT: FlowTemplate = {
  slug: "faq_bot",
  name: "FAQ bot",
  description:
    "Answer common questions automatically. Customer picks a topic from a list; the bot replies with the answer and ends.",
  icon: "HelpCircle",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["faq", "question", "info"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "topics" },
    },
    {
      node_key: "topics",
      node_type: "send_list",
      config: {
        text: "What can I help you with?",
        button_label: "View topics",
        sections: [
          {
            title: "Common questions",
            rows: [
              {
                reply_id: "hours",
                title: "Opening hours",
                next_node_key: "answer_hours",
              },
              {
                reply_id: "pricing",
                title: "Pricing",
                next_node_key: "answer_pricing",
              },
              {
                reply_id: "refunds",
                title: "Refund policy",
                next_node_key: "answer_refunds",
              },
            ],
          },
          {
            title: "Other",
            rows: [
              {
                reply_id: "human",
                title: "Talk to a human",
                next_node_key: "human_handoff",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "answer_hours",
      node_type: "send_message",
      config: {
        text: "We're open Mon–Fri, 9am–6pm local time. Weekend support is limited to urgent issues.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "answer_pricing",
      node_type: "send_message",
      config: {
        text: "Our pricing starts at $9/mo. Visit https://example.com/pricing for the full breakdown.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "answer_refunds",
      node_type: "send_message",
      config: {
        text: "Refunds are honored within 30 days of purchase. Reply with your order number and we'll process it.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "human_handoff",
      node_type: "handoff",
      config: {
        note: "Customer asked to talk to a human from the FAQ bot.",
      } as HandoffNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 3. Lead capture — collect_input chain, ends in a handoff
// ============================================================
const LEAD_CAPTURE: FlowTemplate = {
  slug: "lead_capture",
  name: "Lead capture",
  description:
    "Greet first-time inbounds, capture name + email + company, then hand off to sales with the answers in the note.",
  icon: "UserPlus",
  trigger_type: "first_inbound_message",
  trigger_config: {},
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "intro" },
    },
    {
      node_key: "intro",
      node_type: "send_message",
      config: {
        text: "Welcome! 👋 I'll ask a few quick questions so we can get you to the right person.",
        next_node_key: "ask_name",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "ask_name",
      node_type: "collect_input",
      config: {
        prompt_text: "What's your name?",
        var_key: "name",
        next_node_key: "ask_email",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_email",
      node_type: "collect_input",
      config: {
        prompt_text: "Thanks {{vars.name}}! What's your work email?",
        var_key: "email",
        next_node_key: "ask_company",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_company",
      node_type: "collect_input",
      config: {
        prompt_text: "Almost done — what's your company name?",
        var_key: "company",
        next_node_key: "handoff",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "handoff",
      node_type: "handoff",
      config: {
        note: "New lead — name={{vars.name}}, email={{vars.email}}, company={{vars.company}}.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 4–8. Templates used by the consulting / commercial operation
// ============================================================
function intakeTemplate(slug: string, name: string, description: string, trigger: string[], questions: Array<[string, string]>, handoff: string): FlowTemplate {
  const nodes: FlowTemplateNode[] = [{ node_key: "start", node_type: "start", config: { next_node_key: "intro" } }, { node_key: "intro", node_type: "send_message", config: { text: "Olá! Vou fazer algumas perguntas rápidas para entender seu contexto e encaminhar você para a pessoa certa.", next_node_key: "q1" } as SendMessageNodeConfig }];
  questions.forEach(([key, prompt], index) => nodes.push({ node_key: `q${index + 1}`, node_type: "collect_input", config: { prompt_text: prompt, var_key: key, next_node_key: index === questions.length - 1 ? "handoff" : `q${index + 2}` } as CollectInputNodeConfig }));
  nodes.push({ node_key: "handoff", node_type: "handoff", config: { note: `${handoff} Dados: ${questions.map(([key]) => `${key}={{vars.${key}}}`).join(", ")}` } as HandoffNodeConfig });
  return { slug, name, description, icon: "MessageSquare", trigger_type: "keyword", trigger_config: { keywords: trigger, match_type: "contains" }, entry_node_id: "start", nodes };
}

const DIAGNOSTIC_INTAKE = intakeTemplate("business_diagnostic_intake", "Diagnóstico empresarial", "Coleta contexto, gargalo e meta antes do diagnóstico consultivo.", ["diagnostico", "diagnóstico", "analisar meu negócio"], [["company", "Qual é o nome da empresa?"], ["segment", "Em que segmento vocês atuam?"], ["bottleneck", "Qual é o principal gargalo comercial hoje?"], ["goal", "Qual resultado você quer alcançar nos próximos 90 dias?"]], "Novo diagnóstico para revisão humana.");
const CONSULTATION_BOOKING = intakeTemplate("consultation_booking", "Agendamento de consulta", "Qualifica o pedido de consulta e entrega o contexto para agendamento ou cobrança.", ["consulta", "agendar", "reunião"], [["service", "Qual serviço ou tema você quer tratar?"], ["preferred_time", "Qual melhor dia e horário para falar?"], ["contact", "Qual e-mail ou telefone para confirmarmos?"]], "Pedido de consulta pronto para confirmação e pagamento.");
const RESEARCH_BRIEF = intakeTemplate("research_brief", "Briefing de pesquisa e benchmark", "Recebe o briefing mínimo para pesquisa de mercado, concorrentes, preço e posicionamento.", ["pesquisa", "benchmark", "concorrentes"], [["market", "Qual mercado ou região devemos pesquisar?"], ["offer", "Qual produto ou oferta será analisado?"], ["competitors", "Quais concorrentes ou referências já conhece?"], ["decision", "Que decisão essa pesquisa precisa apoiar?"]], "Briefing de pesquisa aguardando execução e fontes.");
const STRATEGIC_ONBOARDING = intakeTemplate("strategic_onboarding", "Onboarding do plano estratégico", "Organiza informações para ICP, persona, SWOT, oferta e plano de ação.", ["planejamento", "plano estratégico", "estratégia"], [["business_stage", "Em que fase a empresa está hoje?"], ["ideal_customer", "Quem é o cliente ideal atualmente?"], ["strength", "Qual é a maior força do negócio?"], ["priority", "Qual prioridade deve entrar no plano de ação?"]], "Onboarding estratégico pronto para análise dos agentes.");
const POST_CONSULTATION_FOLLOWUP = intakeTemplate("post_consultation_followup", "Pós-consulta e próximo passo", "Recolhe feedback, pendências e autorização para o próximo workflow.", ["feedback", "próximo passo", "pos consulta"], [["feedback", "O que foi mais útil na consulta?"], ["pending", "O que ficou pendente ou precisa de correção?"], ["next_step", "Qual próximo passo você quer executar?"]], "Feedback recebido; revisar antes de iniciar o próximo fluxo.");

// ============================================================
// Registry
// ============================================================

const TEMPLATES: Record<string, FlowTemplate> = {
  welcome_menu: WELCOME_MENU,
  faq_bot: FAQ_BOT,
  lead_capture: LEAD_CAPTURE,
  business_diagnostic_intake: DIAGNOSTIC_INTAKE,
  consultation_booking: CONSULTATION_BOOKING,
  research_brief: RESEARCH_BRIEF,
  strategic_onboarding: STRATEGIC_ONBOARDING,
  post_consultation_followup: POST_CONSULTATION_FOLLOWUP,
};

export function getFlowTemplate(slug: string): FlowTemplate | null {
  return TEMPLATES[slug] ?? null;
}

export function listFlowTemplates(): FlowTemplate[] {
  return Object.values(TEMPLATES);
}
