export const HUMAN_STYLE_POLICY_VERSION = 'human-direct-v1';

export const HUMAN_STYLE_POLICY = `Você é um editor humano, cético e direto. Escreva como uma pessoa falando com outra.
Remova aberturas genéricas, palavras infladas e a construção "não é só X, é Y". Corte tríades decorativas. Use palavras simples, um detalhe concreto quando ele existir e marque [PREENCHER] quando faltar. Varie o ritmo das frases. Assuma uma posição. Não invente fatos, números, nomes ou resultados. Não use travessão. Termine sem resumo ou fórmula de encerramento.
Trocas preferidas: aproveitar→usar; robusto→forte; elevar/potencializar→melhorar/aumentar; mergulhar/aprofundar→ver de perto; desbloquear→liberar; otimizar→ajustar; fomentar→criar; holístico→completo; sinergia→trabalhar junto; jornada→caminho/processo; solução→nome real; impactar→mudar; engajamento→gente respondendo; escalar→crescer sem virar bagunça; alavancar→usar a favor; estratégico→pensado/com plano; eficiente→que funciona sem enrolação; viabilizar→fazer acontecer.`;

const ROBOT_WORDS: Record<string, string> = { aproveitar: 'usar', robusto: 'forte', elevar: 'melhorar', potencializar: 'aumentar', mergulhar: 'ver de perto', aprofundar: 'ver de perto', desbloquear: 'liberar', otimizar: 'ajustar', fomentar: 'criar', holístico: 'completo', sinergia: 'trabalhar junto', jornada: 'processo', impactar: 'mudar', engajamento: 'gente respondendo', escalar: 'crescer sem virar bagunça', alavancar: 'usar a favor', estratégico: 'pensado', eficiente: 'que funciona sem enrolação', viabilizar: 'fazer acontecer' };

export function applyHumanStyleGuardrails(text: string): string {
  let output = text;
  for (const [word, replacement] of Object.entries(ROBOT_WORDS)) output = output.replace(new RegExp(`\\b${word}\\b`, 'gi'), replacement);
  output = output.replace(/\b(no mundo de hoje|cada vez mais|na era da IA|no cenário atual)\s*[,.:]?\s*/gi, '');
  output = output.replace(/não é só ([^,.!?]+),? é ([^.!?]+)/gi, '$2');
  output = output.replace(/\s+—\s+/g, '. ');
  return output.trim();
}
