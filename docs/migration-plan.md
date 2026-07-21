# Plano de migração

1. Aplicar `054_consulting_methodology_engine.sql` em ambiente de desenvolvimento.
2. Criar o primeiro projeto a partir de `commercial_profiles` e `commercial_assessments`, sem copiar dados clínicos.
3. Associar `commercial_strategy_plans` a `consulting_artifacts` por uma camada de serviço.
4. Registrar definições de agentes e workflows aprovados.
5. Implementar a execução vertical com provider local/testável.
6. Validar em projeto-piloto antes de aplicar em produção.

A migration não foi aplicada remotamente nesta etapa.
