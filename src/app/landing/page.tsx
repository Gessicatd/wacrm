import type { Metadata } from 'next'
import { LandingContent } from './landing-content'

export const metadata: Metadata = {
  title: 'wacrm — CRM para WhatsApp auto-hospedável',
  description:
    'CRM completo para WhatsApp: inbox compartilhada, pipeline de vendas, automações no-code, chatbot visual com IA, broadcasts e muito mais. Código aberto, seus dados, sua infraestrutura.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'wacrm — CRM para WhatsApp auto-hospedável',
    description:
      'CRM completo para WhatsApp: inbox compartilhada, pipeline de vendas, automações no-code, chatbot visual com IA, broadcasts e muito mais.',
    type: 'website',
    locale: 'pt_BR',
  },
}

export default function LandingPage() {
  return <LandingContent />
}
