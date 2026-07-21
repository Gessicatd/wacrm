# Modelo de domínio

## Entidades novas (migration 054)

- `consulting_projects`: contexto e ciclo de vida do projeto.
- `consulting_methodologies`: metodologia versionada e publicada.
- `consulting_methodology_steps`: etapas, entradas, saídas, regras e validação.
- `consulting_agent_definitions`: agentes com schema, ferramentas e modo de autonomia.
- `consulting_workflow_definitions`: workflows determinísticos/híbridos.
- `consulting_executions`: execução auditável com input, output, evidências, custo e erro.
- `consulting_artifacts`: diagnóstico, benchmark, ICP, persona, SWOT, plano e relatório.
- `consulting_recommendations`: decisão rastreável com impacto, esforço, risco e owner.
- `consulting_action_items`: tarefas executáveis ligadas a recomendações e KPIs.

Todas as tabelas têm `account_id`, RLS, timestamps e índices account-scoped. Artefatos e projetos têm soft delete. Nenhuma tabela deve receber dados clínicos ou de pacientes.
