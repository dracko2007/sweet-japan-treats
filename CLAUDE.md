# Japan Express — Guia do projeto para o Claude Code

Loja de produtos importados do Japão (cosméticos, doces, acessórios). Vendas
internacionais com cálculo de frete, impostos e moeda por país de destino.

## Stack
- **Frontend:** React + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend:** Firebase (Firestore, Auth, Storage) + funções serverless na Vercel (`/api/*.js`)
- **Deploy:** Vercel (auto-deploy ao dar push na branch `main`)
- **Imagens:** Cloudinary

## Comandos
```bash
npm run dev      # servidor de desenvolvimento (Vite)
npm run build    # build de produção (vite build) — é o que a Vercel roda
npm run lint     # ESLint
npm run test     # Vitest
```
> **Nota:** este ambiente não tem `node`/`npm` no PATH global. Use:
> `export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"` antes dos comandos.
> Type-check direto: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json`
> (a Vercel usa esbuild via Vite e **não** roda `tsc`, então erros TS pré-existentes
> não bloqueiam o deploy — mas evite introduzir novos).

## Países, moeda, frete e impostos (importante)
A loja atende vários destinos. Cada país define **moeda + idioma + zona de frete + imposto**:

| País | Moeda | Idioma | Zona Japan Post | Imposto |
|------|-------|--------|-----------------|---------|
| Brasil | BRL (R$) | pt | 5 | II + ICMS (Remessa Conforme) |
| Portugal/França/Itália/Espanha | EUR (€) | pt/en | 3 | IVA por país |
| Estados Unidos | USD ($) | en | 4 | Sales tax por estado |
| Japão | JPY (¥) | ja | local | — |

Arquivos-chave:
- `src/context/LanguageContext.tsx` — `CountryType`, detecção por IP, `fxRates`
- `src/utils/currency.ts` — `getCurrencyByCountry`, `formatPrice`
- `src/services/fxService.ts` — cotação ¥→BRL/EUR/USD (Wise via `/api/wise-rate`, fallback open.er-api)
- `src/utils/taxRules.ts` — `calcBrazilTax`, `calcEuVat`, `calcUsSalesTax` (`US_SALES_TAX` por estado)
- `src/utils/japanPostRates.ts` — tabelas oficiais e-Packet Light/EMS/Air Parcel + `countryToZone`
- `src/utils/shippingDimensions.ts` — peso da caixa (usa `weightGrams` real do produto se houver)

**Ao adicionar um país novo:** atualizar `CountryType`, `COUNTRY_MAP`, `getCurrencyByCountry`,
`countryToZone`, `CountrySwitcher`, e o cálculo de imposto/CEP no `Checkout`.

## Produtos
- Tipo em `src/types/index.ts`. Campos relevantes: `weightGrams` (frete por peso),
  `deliveryRestrict` (`'exterior-only'` = produto japonês não vende no Japão; `'japan-only'` = importado),
  `origin: 'importado'`, `variants[]` (preços por tamanho/kit em ¥).
- Editor: `src/components/admin/ProductManager.tsx` (Auto-preencher via `/api/product-enrich`
  busca Rakuten/Yahoo em japonês — preço, fotos, descrição, peso).

## Catálogo SEO / Google Merchant
- `api/feed.js` gera feed XML/JSON com preço + frete por peso. Rotas em `vercel.json`:
  `/feed.xml` (BR), `/feed-eu.xml` (EU), `/feed-us.xml` (US), `/feed.json`.
- `src/components/ProductJsonLd.tsx` injeta Schema.org Product/Offer na página de produto.
- Google Merchant rejeita imagens **base64** e **WebP** → o feed usa só URLs http e força JPG.

## Convenções
- Preços de produto sempre em **¥** no Firestore; conversão para a moeda do cliente é no front.
- Páginas legais traduzidas inline (PT/EN/JA) — ver `src/pages/ReturnPolicy.tsx` como modelo.
- Admin protegido; e-mail do super-admin é `dracko2007@gmail.com`.
- Idioma do produto: **nome em inglês**, só a **descrição** é traduzida por IA.

## Git
- Commitar/push só quando pedido. Mensagens em português.
- **Nunca** use `git add -A` sem checar — a pasta `.claude/` (worktrees de subagentes,
  arquivos internos) não deve ir para o repo. Já está no `.gitignore`.
- Adicione produtos/preços ao Firestore via Admin SDK com `serviceAccountKey.json`
  (project: `localstorage-98492`) quando precisar de migração em massa.
