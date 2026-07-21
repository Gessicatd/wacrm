# Methodology Engine

O Methodology Engine converte fontes em etapas executáveis. A ingestão deve segmentar, classificar e extrair objetivos, entradas, saídas, regras, ferramentas, agentes, validações e dependências. O resultado é editável e só pode ser publicado após revisão.

## Classificação

- `manual`: decisão ou entrevista humana;
- `automated`: regra ou workflow determinístico;
- `agent`: interpretação, pesquisa ou síntese;
- `workflow`: sequência com condições e retries;
- `hybrid`: coleta determinística + agente + revisão.

## Evidência

Conclusões usam `fact`, `hypothesis`, `inference` ou `recommendation`, sempre com fonte, confiança, limitações e indicação de revisão humana.
