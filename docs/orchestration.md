# Orquestração

`consulting_executions` é o registro comum para execução de etapa, agente ou workflow. Estados: `queued`, `running`, `waiting_review`, `completed`, `failed`, `cancelled`.

## Regras

- execução recebe `project_id` e `account_id` obrigatórios;
- retry é limitado e contado;
- falha não apaga output anterior;
- `waiting_review` interrompe ações externas;
- retomada usa a execução persistida, não memória do navegador;
- um futuro worker deverá reivindicar execuções com lock/claim idempotente.
