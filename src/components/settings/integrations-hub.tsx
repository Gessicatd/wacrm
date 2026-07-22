'use client';

import Link from 'next/link';
import { ArrowUpRight, CreditCard, Database, Megaphone, ShieldCheck, Sparkles } from 'lucide-react';
import { GhlImport } from './ghl-import';

const cards = [
  { title: 'Pagamentos', text: 'Escolha Pix bancário, Mercado Pago, Asaas ou PagBank. Segredos ficam criptografados e somente administradores configuram.', href: '/payments', icon: CreditCard, docs: 'https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials' },
  { title: 'Meta Ads e Google Ads', text: 'Configure OAuth, UTMs, pixels, conversões e atribuição por empresa.', href: '/marketing/attribution', icon: Megaphone },
  { title: 'GoHighLevel', text: 'Importe contatos de forma incremental e idempotente, sem duplicar registros.', href: '#ghl', icon: Database },
  { title: 'Agentes e pesquisa', text: 'Controle fontes, aprovação humana, estratégia e execução no Centro de Pesquisa.', href: '/commercial/research', icon: Sparkles },
];

export function IntegrationsHub() {
  return <section className="space-y-5">
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="font-semibold">Central de configuração do ecossistema</h2><p className="mt-1 text-sm text-muted-foreground">Cada integração mostra o que precisa ser configurado, onde obter credenciais e quem pode acessar. Segredos nunca são exibidos novamente depois de salvos.</p></div></div></div>
    <div className="grid gap-4 md:grid-cols-2">{cards.map(({ title, text, href, icon: Icon, docs }) => <article key={title} className="rounded-2xl border border-border bg-card p-5"><Icon className="h-5 w-5 text-primary" /><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{text}</p><div className="mt-4 flex flex-wrap gap-3"><Link href={href} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Abrir configuração <ArrowUpRight className="h-3.5 w-3.5" /></Link>{docs && <a href={docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Documentação oficial <ArrowUpRight className="h-3.5 w-3.5" /></a>}</div></article>)}</div>
    <div id="ghl"><GhlImport /></div>
  </section>;
}
