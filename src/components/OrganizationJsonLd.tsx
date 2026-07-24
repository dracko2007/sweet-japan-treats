import { useEffect } from 'react';

const SITE_URL = 'https://www.japanexpress-store.com';

/**
 * Injeta Schema.org Organization no <head>, uma única vez, em toda página
 * (montado no Layout). O Google usa isso para o painel de conhecimento e
 * para vincular os perfis sociais à marca na busca. Mesmo padrão de
 * criar/reusar <script id> + remover no cleanup usado em ProductJsonLd.
 */
const OrganizationJsonLd: React.FC = () => {
  useEffect(() => {
    const jsonLd = {
      '@context': 'https://schema.org/',
      '@type': 'Organization',
      name: 'Japan Express',
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512x512.png`,
      sameAs: [
        'https://www.instagram.com/japan_express_official/',
        'https://www.facebook.com/japanexpressoficial',
        'https://www.tiktok.com/@japanexpressoficial',
        'https://x.com/japanexpress_of',
      ],
    };

    const scriptId = 'organization-jsonld';
    let el = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.id = scriptId;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(jsonLd);

    return () => {
      document.getElementById(scriptId)?.remove();
    };
  }, []);

  return null;
};

export default OrganizationJsonLd;
