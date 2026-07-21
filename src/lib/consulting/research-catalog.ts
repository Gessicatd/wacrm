export const RESEARCH_BASE_CATALOG_VERSION = '1.0.0';

export const RESEARCH_BASE_CATALOG = [
  {
    key: 'market-sector',
    title: 'Mercado e setor',
    objective: 'Mapear contexto, demanda, linguagem, maturidade e restrições do setor.',
    requiredEvidence: ['fontes setoriais autorizadas', 'dados declarados do negócio'],
    outputs: ['contexto', 'tendências', 'riscos', 'lacunas'],
  },
  {
    key: 'benchmark',
    title: 'Benchmark competitivo',
    objective: 'Comparar público, promessa, mecanismo, oferta, prova, preço publicado, CTA e funil.',
    requiredEvidence: ['páginas, anúncios ou propostas identificadas por fonte'],
    outputs: ['matriz comparativa', 'padrões', 'oportunidades sem cópia'],
  },
  {
    key: 'icp-persona',
    title: 'ICP e persona',
    objective: 'Estruturar perfil ideal, desqualificadores, dores, desejos, objeções e jornada.',
    requiredEvidence: ['diagnóstico aprovado', 'conversas ou observações autorizadas'],
    outputs: ['ICP', 'persona', 'nível de consciência', 'hipóteses a validar'],
  },
  {
    key: 'positioning',
    title: 'Posicionamento',
    objective: 'Definir categoria, especialidade, promessa, mecanismo, diferenciais e provas.',
    requiredEvidence: ['benchmark aprovado', 'capacidades e provas reais do negócio'],
    outputs: ['território', 'mensagem central', 'diferenciais verificáveis'],
  },
  {
    key: 'offer-pricing',
    title: 'Oferta e preço',
    objective: 'Construir escopo, transformação, condições e cenários de preço sem inventar valores.',
    requiredEvidence: ['custos', 'margem', 'capacidade', 'ciclo', 'valor percebido', 'comparáveis públicos'],
    outputs: ['arquitetura da oferta', 'faixas e cenários', 'premissas', 'riscos'],
  },
] as const;

export function getResearchBaseCatalog() {
  return {
    version: RESEARCH_BASE_CATALOG_VERSION,
    policy: {
      personalizationFormula:
        'metodologia + pesquisa-base do segmento + dados e fontes da empresa',
      claimClasses: [
        'fact',
        'evidence',
        'inference',
        'hypothesis',
        'recommendation',
        'missing',
      ],
      rules: [
        'Não converter hipótese em fato.',
        'Não gerar preço numérico sem premissas suficientes.',
        'Toda observação externa deve apontar para uma fonte.',
        'Toda saída personalizada exige revisão humana.',
      ],
    },
    modules: RESEARCH_BASE_CATALOG,
  };
}
