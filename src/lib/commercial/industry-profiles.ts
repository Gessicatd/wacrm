export type IndustryProfileKey = 'healthcare' | 'professional_services' | 'consulting' | 'education' | 'other';
export interface IndustryProfile { key: IndustryProfileKey; label: string; description: string; complianceNote: string; defaultOfferLabel: string; }
export const INDUSTRY_PROFILES: Record<IndustryProfileKey, IndustryProfile> = {
  healthcare: { key: 'healthcare', label: 'Clínicas e profissionais de saúde', description: 'Captação, agendamento e handoff comercial sem dados clínicos.', complianceNote: 'Dados clínicos, prontuários e prescrições ficam fora do CRM comercial.', defaultOfferLabel: 'Serviço ou consulta' },
  professional_services: { key: 'professional_services', label: 'Profissionais liberais', description: 'Consultoria, advocacia, contabilidade, arquitetura e outros serviços.', complianceNote: 'Registrar somente contexto comercial necessário para atendimento e venda.', defaultOfferLabel: 'Serviço profissional' },
  consulting: { key: 'consulting', label: 'Consultorias e especialistas', description: 'Diagnóstico, proposta, decisão e implantação de serviços consultivos.', complianceNote: 'Separar dados comerciais de documentos internos e informações confidenciais do cliente.', defaultOfferLabel: 'Projeto de consultoria' },
  education: { key: 'education', label: 'Educação e treinamento', description: 'Cursos, mentorias, turmas e programas com venda consultiva.', complianceNote: 'Guardar apenas dados necessários para matrícula, venda e suporte autorizado.', defaultOfferLabel: 'Curso ou programa' },
  other: { key: 'other', label: 'Outro serviço', description: 'Configure o vocabulário e os limites da operação durante o diagnóstico.', complianceNote: 'Defina os dados permitidos antes de ativar agentes e automações.', defaultOfferLabel: 'Oferta principal' },
};
export function getIndustryProfile(key?: string | null) { return INDUSTRY_PROFILES[(key as IndustryProfileKey) ?? 'other'] ?? INDUSTRY_PROFILES.other; }
