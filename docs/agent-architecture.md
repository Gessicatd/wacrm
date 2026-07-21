# Arquitetura de agentes

## Agentes previstos

Business Intake, Market Research, Benchmark, ICP, Persona, Diagnostic, SWOT, Positioning, Offer, Funnel Architect, Strategic Planning, KPI, Action Plan e Executive Report.

## Contrato mínimo

Cada agente deve declarar `agent_key`, objetivo, instruções, ferramentas permitidas, inputs obrigatórios, `expected_output_schema`, regras de validação e modo de autonomia (`suggest`, `approved_execution` ou `automatic`). Cada execução grava agente, projeto, input, output, evidência, modelo, uso de tokens, custo, duração e erro.

## Segurança operacional

O padrão é sugestão. Mensagens externas, alteração de pipeline, disparos e qualquer ação irreversível exigem aprovação conforme a política da conta. O agente não deve acessar escopos de outra conta.
