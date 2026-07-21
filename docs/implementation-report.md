# Relatório de implementação — reorientação

## Realizado nesta etapa

- auditoria dos módulos existentes;
- definição da arquitetura-alvo;
- migration `054_consulting_methodology_engine.sql` com projetos, metodologias, etapas, agentes, workflows, execuções, artefatos, recomendações e ações;
- RLS e índices account-scoped;
- serviços de domínio para projetos, validação e orquestração determinística;
- APIs account-scoped para projetos, metodologias, execuções e artefatos;
- endpoint vertical que transforma o diagnóstico comercial existente em artefato de plano estratégico persistido;
- testes unitários da validação, dependências e idempotência de entrada;
- documentação do domínio, agentes, Methodology Engine, orquestração, segurança, migração e testes.

## Reutilizado

Onboarding, assessments, planos estratégicos, Knowledge Base, agentes comerciais, pipelines, automações, marketing attribution e permissões existentes.

## Ainda não concluído

- aplicação remota da migration;
- tela operacional para revisar/aprovar artefatos e acompanhar execuções;
- provider de IA externo;
- execução real de pesquisa na web;
- validação com empresa-piloto.

## Verificação

- testes direcionados: 4 aprovados;
- lint dos arquivos novos: aprovado;
- typecheck global: bloqueado por dependência preexistente ausente (`googleapis` em `src/lib/calendar`), sem erro reportado nos arquivos desta entrega.
