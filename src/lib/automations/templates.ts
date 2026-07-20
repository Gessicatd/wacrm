import type {
  AutomationStepConfig,
  AutomationStepType,
  AutomationTriggerConfig,
  AutomationTriggerType,
} from '@/types'

export type TemplateSlug =
  | 'welcome_message'
  | 'out_of_office'
  | 'lead_qualifier'
  | 'follow_up_reminder'
  | 'health_lead_intake'
  | 'appointment_confirmation'
  | 'plan_follow_up'

export interface TemplateStepSeed {
  step_type: AutomationStepType
  step_config: AutomationStepConfig
  branch?: 'yes' | 'no' | null
  /** Index (within this seed list) of the Condition parent, if nested. */
  parent_index?: number | null
}

export interface AutomationTemplateDefinition {
  slug: TemplateSlug
  name: string
  description: string
  trigger_type: AutomationTriggerType
  trigger_config: AutomationTriggerConfig
  steps: TemplateStepSeed[]
}

export const AUTOMATION_TEMPLATES: Record<TemplateSlug, AutomationTemplateDefinition> = {
  welcome_message: {
    slug: 'welcome_message',
    name: 'Welcome Message',
    description: 'Auto-reply to first-time contacts with a greeting.',
    // first_inbound_message (added in PR #33) catches both brand-new
    // contacts AND manually-added/imported contacts on their first-ever
    // reply, which is what a user setting up a "welcome" automation
    // almost always wants. new_contact_created would miss the
    // manually-imported case.
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: "Hi! 👋 Thanks for reaching out. We'll get back to you shortly.",
        },
      },
      {
        step_type: 'add_tag',
        step_config: { tag_id: '' },
      },
    ],
  },
  out_of_office: {
    slug: 'out_of_office',
    name: 'Out of Office',
    description: 'Auto-reply during off-hours so nobody is left waiting.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'condition',
        step_config: {
          subject: 'time_of_day',
          operand: '18:00-09:00',
        },
      },
      {
        step_type: 'send_message',
        step_config: {
          text:
            "Thanks for your message! Our team is offline right now (9am–6pm) and will reply first thing tomorrow.",
        },
        parent_index: 0,
        branch: 'yes',
      },
    ],
  },
  lead_qualifier: {
    slug: 'lead_qualifier',
    name: 'Lead Qualifier',
    description: 'Ask qualification questions to filter inbound leads.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['pricing', 'quote', 'buy'],
      match_type: 'contains',
    },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text:
            "Great — happy to help with pricing! Quick question: roughly how many seats are you looking for?",
        },
      },
      {
        step_type: 'wait',
        step_config: { amount: 10, unit: 'minutes' },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  follow_up_reminder: {
    slug: 'follow_up_reminder',
    name: 'Follow-up Reminder',
    description: 'Send a nudge if a contact has not replied within 24 hours.',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [
      {
        step_type: 'wait',
        step_config: { amount: 1, unit: 'days' },
      },
      {
        step_type: 'send_message',
        step_config: {
          text:
            "Just circling back — did you have any other questions for us? Happy to help!",
        },
      },
    ],
  },
  health_lead_intake: {
    slug: 'health_lead_intake',
    name: 'High-ticket Lead Intake',
    description: 'Acknowledge a new enquiry, collect commercial context and hand off to a human.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Olá! Obrigado por falar com a nossa equipe. Para direcionarmos seu atendimento, qual resultado você está buscando e qual é a melhor cidade/unidade para você?',
        },
      },
      { step_type: 'wait', step_config: { amount: 5, unit: 'minutes' } },
      { step_type: 'assign_conversation', step_config: { mode: 'round_robin' } },
    ],
  },
  appointment_confirmation: {
    slug: 'appointment_confirmation',
    name: 'Evaluation Confirmation',
    description: 'Confirm an evaluation and route questions to the team without giving clinical advice.',
    trigger_type: 'tag_added',
    trigger_config: { tag_id: '' },
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Sua avaliação está agendada. Pode confirmar sua presença respondendo SIM? Se precisar alterar o horário ou tiver alguma dúvida, nossa equipe assume a conversa por aqui.',
        },
      },
      { step_type: 'wait', step_config: { amount: 1, unit: 'days' } },
      { step_type: 'assign_conversation', step_config: { mode: 'round_robin' } },
    ],
  },
  plan_follow_up: {
    slug: 'plan_follow_up',
    name: 'Post-plan Follow-up',
    description: 'Consent-aware follow-up after a plan is presented, with a clean human handoff.',
    trigger_type: 'tag_added',
    trigger_config: { tag_id: '' },
    steps: [
      { step_type: 'wait', step_config: { amount: 1, unit: 'days' } },
      {
        step_type: 'send_message',
        step_config: {
          text: 'Olá! Ficou alguma dúvida sobre as etapas, condições ou próximos passos apresentados? Posso pedir para a pessoa responsável falar com você.',
        },
      },
      { step_type: 'wait', step_config: { amount: 2, unit: 'days' } },
      { step_type: 'assign_conversation', step_config: { mode: 'round_robin' } },
    ],
  },
}

export function getTemplate(slug: string): AutomationTemplateDefinition | null {
  return AUTOMATION_TEMPLATES[slug as TemplateSlug] ?? null
}
