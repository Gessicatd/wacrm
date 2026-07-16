# Commercial system for high-ticket health and aesthetics

This fork extends wacrm with a commercial operating layer for clinics and premium service providers. It is a CRM, not a clinical record system.

## Apply the migration

Apply `supabase/migrations/043_healthcare_commercial_system.sql` after the existing migrations. It adds:

- stage entry/exit criteria, SLA and evidence-based probability;
- service, unit, professional, source and intent fields;
- appointment and attendance status;
- mandatory operational next-action fields;
- three-level forecast (`commit`, `best_case`, `stretch`);
- objection, loss, recycling, consent and handoff fields;
- commercial onboarding profiles and assessment history;
- account-scoped RLS and lifecycle timestamps.

## Default pipeline

New accounts receive the `Jornada Comercial High Ticket` pipeline:

1. Novo interessado
2. Pré-qualificação
3. Avaliação agendada
4. Avaliação confirmada
5. Avaliação realizada
6. Plano apresentado
7. Em decisão
8. Contratado

Each stage has an objective exit criterion, SLA and probability. Teams should edit these to match their real operation rather than adding duplicate stages.

## Onboarding integration

Authenticated admins can submit the executive quiz to `POST /api/commercial/onboarding`:

```json
{
  "answers": {
    "role": "owner",
    "businessName": "Clínica Exemplo",
    "specialty": "aesthetics",
    "mainOffer": "Programa premium",
    "capacity": "25",
    "priority": "conversion",
    "goal": "Increase plan-to-contract conversion by 20%"
  },
  "dimension_scores": {
    "Atendimento": 70,
    "Conversão": 40,
    "Processo": 55,
    "Dados": 30,
    "Governança": 75
  },
  "overall_score": 54,
  "evidence_status": {
    "crm_export": "missing",
    "won_conversations": "missing",
    "lost_conversations": "missing"
  }
}
```

The endpoint stores the original assessment and creates/updates the account's structured commercial profile. It intentionally marks the profile `needs_evidence`: questionnaire answers are hypotheses until volumes, conversations and CRM data are validated.

## Data boundary

Allowed in the CRM:

- commercial interest, service, source and campaign;
- scheduling state and attendance status;
- objections, next action, forecast and handoff;
- consent provenance needed for communication governance.

Keep outside the CRM:

- diagnoses, prescriptions and clinical notes;
- exams and health history;
- before/after or other clinical images;
- contraindications and adverse-event records.

Those belong in an appropriate clinical system. AI prompts and automations must not copy them into deal notes or handoff fields.

## First automation set

Use the existing visual automation engine to configure:

1. New inbound lead: route, acknowledge and alert on SLA breach.
2. Appointment confirmation: reminders, confirmation and human escalation.
3. Post-plan follow-up: approved templates, stop on reply and route clinical questions to a professional.
4. Stale pipeline: alert on missing/overdue next action.
5. Won handoff: change `handoff_status` to `pending`, notify delivery and verify completion.

Use the official Meta WhatsApp Business API for production health-sector deployments. Test every flow with synthetic data before activation.

