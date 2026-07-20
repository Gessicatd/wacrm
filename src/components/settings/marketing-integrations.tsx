'use client';

import Link from 'next/link';
import { BarChart3, ExternalLink, Facebook, Globe, Search } from 'lucide-react';

export function MarketingIntegrations() {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Marketing e anúncios</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure rastreamento, origem dos leads e os identificadores das suas campanhas.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4"><Facebook className="h-5 w-5 text-primary" /><h3 className="mt-3 font-medium">Meta Ads</h3><p className="mt-1 text-sm text-muted-foreground">Pixel, Dataset e atribuição de campanhas.</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><Search className="h-5 w-5 text-primary" /><h3 className="mt-3 font-medium">Google Ads</h3><p className="mt-1 text-sm text-muted-foreground">GCLID, campanhas e conversões offline.</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><Globe className="h-5 w-5 text-primary" /><h3 className="mt-3 font-medium">GTM e site</h3><p className="mt-1 text-sm text-muted-foreground">UTMs, consentimento e eventos.</p></div>
      </div>
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-start gap-3"><BarChart3 className="mt-0.5 h-5 w-5 text-primary" /><div><h3 className="font-medium">Abrir central de atribuição</h3><p className="mt-1 text-sm text-muted-foreground">É nesta tela que você informa IDs do Meta, Google e GTM e acompanha de onde vêm os resultados.</p><Link href="/marketing/attribution" className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Configurar agora <ExternalLink className="h-4 w-4" /></Link></div></div>
      </div>
    </section>
  );
}
