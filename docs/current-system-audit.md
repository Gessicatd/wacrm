# Auditoria do sistema atual

## Resumo

O WACRM é um CRM multi-tenant em Next.js 16 + Supabase. Já possui inbox, WhatsApp/Instagram, contatos, negócios, pipelines, automações, atribuição de marketing, onboarding comercial, diagnóstico, plano estratégico, playbooks, agentes comerciais e Knowledge Base.

## Mapa de reutilização

| Módulo | Estado atual | Utilidade | Ação |
|---|---|---|---|
| `commercial_profiles` / `commercial_assessments` | Persistente e account-scoped | Briefing e diagnóstico | Manter e usar como entrada do projeto |
| `commercial_strategy_plans` | Persistente e versionado | Plano estratégico | Integrar aos artefatos estratégicos |
| `commercial_agents` | Configuração e auditoria | Governança de agentes | Adaptar para definições do Methodology Engine |
| `src/lib/knowledge` | Documentos, versões, chunks e ingestão | Conhecimento metodológico | Manter; adicionar associação a projetos/etapas |
| `funnels` / pipelines | Operacional | Execução comercial | Manter e gerar a partir de artefatos aprovados |
| marketing OAuth/attribution | Implementado, credenciais externas pendentes | Pesquisa e medição | Integrar às execuções de pesquisa |
| telas comerciais | Parcialmente funcionais | Operação do consultor | Conectar a estados persistidos, sem mocks |

## Lacunas encontradas

- não havia entidade de projeto de consultoria separada do account;
- metodologia, etapas, execuções e artefatos não tinham modelo persistente próprio;
- recomendações não eram convertidas em plano de ação rastreável;
- não existia um primeiro contrato comum para execução de agentes e workflows;
- o dashboard de projeto continua sendo um snapshot operacional, não um medidor de execução do Methodology Engine.

## Decisão

Adicionar uma camada de consultoria sobre o CRM existente, sem substituir inbox, deals, pipelines, Knowledge Base ou automações. A migration `054_consulting_methodology_engine.sql` cria a fundação account-scoped para essa camada.
