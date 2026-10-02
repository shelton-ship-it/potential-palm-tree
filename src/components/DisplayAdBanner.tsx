'use client';
import React, { useEffect, useState } from 'react';
import { adsApi } from '@/lib/api';

// components/DisplayAdBanner.tsx
//
// Banner "display" do Adsterra (atOptions + invoke.js — o formato real que
// eles usam). Cada instância corre dentro do PRÓPRIO iframe (via srcDoc) —
// o Adsterra usa uma variável global (`atOptions`) pro script configurar o
// banner, então dois banners na mesma página sem isolamento pisam um no
// outro. O iframe dá a cada um a sua própria janela/global, sem conflito.
//
// Plug-and-play: só liga quando `ads.show_ads:true`, 'display' estiver nos
// `formats` da plataforma, e ADSTERRA_BANNER_KEY + ADSTERRA_BANNER_SCRIPT_HOST
// estiverem configurados no backend. Até lá, não renderiza nada.

interface BannerConfig {
  key: string;
  host: string;
  width: number;
  height: number;
}

export default function DisplayAdBanner() {
  const [config, setConfig] = useState<BannerConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    adsApi.status().then(ctx => {
      if (cancelled) return;
      const banner = ctx?.network?.banner;
      const eligible = !!ctx.show_ads && Array.isArray(ctx.formats) && ctx.formats.includes('display');
      if (eligible && banner?.key && banner?.host) setConfig(banner);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!config) return null;

  const srcDoc = `<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body>
<script>
atOptions = { 'key': '${config.key}', 'format': 'iframe', 'height': ${config.height}, 'width': ${config.width}, 'params': {} };
<\/script>
<script src="https://${config.host}/${config.key}/invoke.js"><\/script>
</body></html>`;

  return (
    <iframe
      title="Anúncio"
      srcDoc={srcDoc}
      width={config.width}
      height={config.height}
      style={{ border: 'none', overflow: 'hidden', display: 'block', margin: '0 auto' }}
      scrolling="no"
    />
  );
}
