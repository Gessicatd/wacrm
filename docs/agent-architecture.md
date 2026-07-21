# Arquitetura de agentes

## Agentes previstos

Business Intake, Market Research, Benchmark, ICP, Persona, Diagnostic, SWOT, Positioning, Offer, Funnel Architect, Strategic Planning, KPI, Action Plan e Executive Report.

## Contrato mínimo

Cada agente deve declarar `agent_key`, objetivo, instruções, ferramentas permitidas, inputs obrigatórios, `expected_output_schema`, regras de validação e modo de autonomia (`suggest`, `approved_execution` ou `automatic`). Cada execução grava agente, projeto, input, output, evidência, modelo, uso de tokens, custo, duração e erro.

## Segurança operacional

O padrão é sugestão. Mensagens externas, alteração de pipeline, disparos e qualquer ação irreversível exigem aprovação conforme a política da conta. O agente não deve acessar escopos de outra conta.

## Primeiro runtime funcional

O agente `diagnosis-strategy-v1` opera deterministicamente sobre o perfil comercial e o assessment mais recentes da conta. Ele usa somente `read_commercial_profile`, `read_latest_assessment` e `build_strategy_plan`; pesquisa externa não é simulada como fato. Ausências viram lacunas explícitas.

O ciclo operacional é `queued → running → waiting_review → completed`. O runtime gera um `strategic_plan` com status `in_review`, evidências classificadas, limitações e logs resumidos das ferramentas. Somente administrador pode aprovar. Pedidos de mudança permanecem em revisão e exigem feedback.

`consulting_execution_events` registra transições sanitizadas. `consulting_artifact_reviews` registra a decisão humana. Tokens, cookies, cabeçalhos de autorização e secrets são proibidos nesses metadados e passam por redação centralizada antes de logs genéricos.
