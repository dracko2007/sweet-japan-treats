# Auditoria focada — login, cupons/promoções, carrinho abandonado, webhook Stripe

**Projeto:** `japanexpress/temu_shop`
**Data:** 05/08/2026
**Escopo:** `api/_lib/auth.js`, `api/coupons.js`, `api/_lib/coupon-eligibility.js`, `api/_lib/promo-reserve.js`, `api/_lib/promo-identity.js`, `api/orders.js`, `api/notify.js`, `api/cart-recovery.js`, `api/_lib/cart-recovery-profile.js`, `api/_lib/mailer.js`, `api/stripe-webhook.js`, `api/_lib/fulfillment.js`, `firestore.rules`, `src/pages/Login.tsx`.

## Adendo — correções aplicadas (07/08/2026)

Os 4 achados da seção "O que encontrei de novo" abaixo foram corrigidos. Commit
`7fb03b3` ("fix(notify): loga erro de e-mail engolido em silêncio; remove
campo morto perCpfLimit"), enviado ao `main` (`push` `41c42e4..7fb03b3`).

| # | Achado | Correção |
|---|---|---|
| 1 | E-mail de confirmação falhava em silêncio em `stripe-webhook.js` (`notifyOrder`) e `orders.js` (`handleConfirmManualPayment`) | `.catch(() => undefined)` → `.catch((erro) => console.error(...))` nos dois pontos (cliente e loja), no padrão de `fulfillment.js` |
| 2 | Cron de recuperação de carrinho engolia erro por documento sem log | Adicionado `console.error` no `catch` antes de contar `skipped`, em `cart-recovery.js:213` |
| 3 | `promo-campaign` não logava nem anexava o motivo da falha de envio | `catch` agora loga com `console.error` e inclui `reason` (mensagem do erro) no item de `results`, em `notify.js:342` |
| 4 | `perCpfLimit` gravado e tipado como configurável, mas nunca lido — o limite real é o lock binário em `promo_usage/{code}_{pessoa}` | Campo removido de `api/notify.js` (escrita) e `src/types/promoCampaign.ts` (tipo); nenhum outro lugar o lia |

Validação: `tsc --noEmit`, `eslint` nos arquivos tocados e suíte completa
(56 arquivos / 390 testes) passando após as quatro mudanças.

Os itens da seção "Status dos itens já conhecidos" abaixo não fazem parte
deste adendo — já estavam corrigidos antes desta auditoria, conforme o
próprio documento registra.

## Como isto foi feito

Antes de revisar linha por linha, li as duas auditorias já existentes no repositório (`AUDITORIA.md` e `AUDITORIA_BUGS_MELHORIAS_2026-07-23.md`) para não repetir achados. Boa notícia: **a maior parte dos itens críticos e altos daquela auditoria já foi corrigida** — os comentários no código têm datas de 27/07 e 04/08/2026 (ontem), então alguém já passou por aqui recentemente. Por isso este documento tem duas partes: (1) o que eu encontrei de novo lendo o código atual e (2) o status real dos itens antigos que ainda diziam "correção futura recomendada".

## O que encontrei de novo

### 1. E-mail de confirmação de pedido falha em silêncio (Stripe e pagamento manual)

**Onde:** `api/stripe-webhook.js:74` (`notifyOrder`) e `api/orders.js:584,586` (`handleConfirmManualPayment`)

```js
await sendMail({ to: order.customerEmail, ...ownerTemplate }).catch(() => undefined);
```

`mailer.js` foi reescrito de propósito (comentário nas linhas 134-138) para NUNCA deixar um e-mail "sumir" sem avisar — se o SMTP recusar o destinatário, `sendMail` agora lança `HttpError`. Só que essas duas chamadas descartam esse erro com `.catch(() => undefined)`, sem nenhum `console.error`. Ou seja: exatamente o cuidado que foi tomado em `mailer.js` é jogado fora aqui. Se o e-mail de confirmação falhar, o pedido é processado normalmente (cobrança feita, estoque baixado) e ninguém — nem o cliente, nem a loja — fica sabendo que o e-mail não saiu. Compare com `fulfillment.js:354-360` e `notify.js` (funções de review), que logam o erro com `console.error` antes de engolir — o padrão certo já existe no projeto, só não foi aplicado aqui.

**Sugestão:** trocar `.catch(() => undefined)` por `.catch((erro) => console.error('[...]', erro?.message))` nos dois pontos, do mesmo jeito que já é feito em `fulfillment.js`.

### 2. Falha silenciosa dentro do cron de recuperação de carrinho

**Onde:** `api/cart-recovery.js:213-216`

```js
} catch {
  await document.ref.update({ reminderClaimId: null, reminderClaimedAt: null }).catch(() => undefined);
  skipped += 1;
}
```

Qualquer erro por documento (Firestore fora do ar, `sendMail` falhando, `recoveryCouponCode` sem `CART_RECOVERY_SECRET`/`CRON_SECRET` configurado) cai aqui sem nenhum log. O endpoint sempre responde `200 { sent, skipped }`, então se a campanha inteira parar de funcionar (por exemplo, variável de ambiente do segredo do cupom não configurada em produção), o retorno do cron continua "sucesso" com `sent: 0` e nada aparece nos logs para investigar. Vale ao menos um `console.error` dentro desse `catch`.

### 3. Campanha promocional (`promo-campaign`) também engole erro de envio sem motivo

**Onde:** `api/notify.js:342-343`

```js
} catch {
  results.push({ email: to, channel: 'email', ok: false });
}
```

Diferente do `password-reset` (linha 173-179) e de `fulfillment.js`, aqui o erro não é logado nem o motivo é anexado ao resultado — o admin só vê `ok: false` sem saber se foi SMTP recusando, endereço inválido ou outra coisa. Pequeno, mas é o tipo de "vírgula" que atrapalha quando o admin pergunta "por que não chegou no fulano".

### 4. `perCpfLimit` existe no dado, mas nunca é lido em lugar nenhum

**Onde:** criado em `api/notify.js:296` (`perCpfLimit: 1`), tipado em `src/types/promoCampaign.ts:25` com o comentário `// padrão 1` — mas `grep` no `api/` e `src/` não encontra nenhuma leitura desse campo.

O limite "1 por pessoa" de fato é aplicado, mas por outro mecanismo (`promo_usage/{code}_{pessoa}` em `orders.js:353`), que é uma trava binária (usou ou não usou) e ignora completamente o valor de `perCpfLimit`. Ou seja, o campo é gravado, aparece no tipo como se fosse configurável ("padrão 1" sugere que dá para mudar), mas hoje é decorativo — mudar esse número no Firestore não teria efeito nenhum. Não é um risco de segurança (o limite real funciona), mas é um campo morto que pode enganar quem for mexer na campanha promocional depois.

## Status dos itens já conhecidos (auditoria de 23/07) que dizem respeito ao que você pediu

Conferi o código atual contra cada item aberto. A maioria foi corrigida — vou listar rápido para você não precisar reabrir o documento antigo:

| Item antigo | Status agora | Onde vi a correção |
|---|---|---|
| **PAY-01** — Stripe confiava no valor enviado pelo navegador | **Corrigido.** O webhook recalcula e compara `amount_received`, `currency` e `stripePaymentIntentId` contra o pedido gravado; se divergir, vai para `payment_review` em vez de confirmar. | `stripe-webhook.js:156-167` |
| **PROMO-01** — Limite de promoção só existia no `localStorage` | **Corrigido.** Reserva por pedido com prazo, transação atômica server-side (`promo_state`, negado a todo mundo nas regras). | `promo-reserve.js`, `orders.js:510-533`, `fulfillment.js:184-195` |
| **RECOVERY-01** — Cron falhava aberto sem `CRON_SECRET` | **Corrigido.** `requireCronSecret` agora responde `503` se a variável não existe, `401` se o segredo está errado. | `auth.js:80-85` |
| **SEC-01** — `decrement-stock.js` público, sem validar pagamento | **Corrigido por remoção.** O endpoint não existe mais; baixa de estoque só acontece dentro da transação atômica de `fulfillOrder`, disparada pelo webhook confirmado. | endpoint removido; `fulfillment.js:175-181` |
| **PUSH-01** — `send-push.js` sem autenticação de admin | **Corrigido.** Consolidado em `notify.js` (`action=push`), exige `requireAdmin` + rate limit. | `notify.js:220-250` |
| **MAIL-01** — `send-email.js` permitia HTML arbitrário sem admin no tipo `promo` | **Corrigido.** Virou `action=promo-campaign`, exige `requireAdmin`; o HTML do e-mail é montado no servidor a partir de campos validados, não aceita HTML livre do cliente. | `notify.js:252-358` |
| **RULES-01** — `coupon_usage`, `cpf_index`, `affiliate_pending` graváveis por qualquer autenticado | **Corrigido.** As três coleções agora são `allow ...: if isAdmin()` — só o Admin SDK (servidor) escreve. | `firestore.rules:211-249` |
| **QA-02** — 5 erros de TypeScript (`CouponManager.tsx`, `PromotionManager.tsx`, `AffiliateManager.tsx`, `Affiliate.tsx`) | **Corrigido.** Rodei `npx tsc -b --pretty false` agora: **0 erros**. | verificado ao vivo |
| **DEPS-01** — 23 vulnerabilidades (1 crítica, 10 altas, 12 moderadas) | **Quase zerado.** `brace-expansion` (alta) e `postcss` (moderada) foram corrigidos via `npm audit fix` (sem breaking change). Restam só as 2 do `react-router` — ver análise de exposição abaixo. | verificado ao vivo, 05/08/2026 |
| **QA-01** — Lint com 325 problemas | **Melhorado, não zerado.** Rodei `npx eslint .` agora: **253 problemas (219 erros, 34 avisos)**, a maioria `no-explicit-any` e scripts auxiliares fora do fluxo de compra. | verificado ao vivo |

## DEPS-01 — react-router: análise de exposição (fecha o item)

Sobraram 2 CVEs moderados em `react-router@6.30.4`, e o único caminho que o `npm audit fix` oferece é `--force` (upgrade major para v7.18.2, breaking change). Antes de forçar um upgrade major num app de e-commerce em produção, vale checar se os CVEs são sequer exploráveis neste código — e são:

- **`GHSA-337j` (injeção via `deserializeErrors()` em hydration SSR):** não se aplica. O projeto é SPA puro via Vite (`vite build`/`vite dev`, sem Next.js nem Remix) — não há SSR, então o caminho vulnerável nunca executa.
- **`GHSA-wrjc` (open redirect via backslash em `<Link to>`/`useNavigate`):** também não é explorável hoje. Conferi todo `to=` e todo `navigate(...)` em `src/` — são sempre string fixa (`'/perfil'`, `'/checkout'`) ou template literal com um ID interno (`` `/produto/${product.id}` ``). O único lugar onde `navigate()` usa um valor vindo de `location.state` é o redirect pós-login (`Login.tsx:47`, `redirectTo = loginState?.from || '/perfil'`), e o único ponto do código inteiro que grava `state: { from: ... }` é `Checkout.tsx:278`, com o literal fixo `'/checkout'` — nenhuma rota lê esse destino de query string, formulário ou `localStorage`. Sem entrada do usuário chegando em `to`/`navigate`, o vetor do CVE não tem por onde entrar.

**Conclusão:** os dois CVEs restantes são risco baixo/não aplicável no estado atual do código. Não há necessidade de rodar `npm audit fix --force` (que subiria para react-router v7 sem revisão e é um trabalho de migração à parte, com mudanças de API). Fica registrado como dívida técnica para planejar com calma, não como pendência de segurança urgente. Se algum dia `to`/`navigate` passar a receber `searchParams`, `location.state` de origem externa ou entrada de formulário sem validar, essa análise precisa ser refeita.

## Parte 2 — UI/UX (itens UX-01 a UX-08, I18N-01, MEDIA-01, MAINT-02, MAINT-03 da auditoria de julho)

Auditoria só de leitura de código (não rodei o site ao vivo neste ambiente — sem navegador disponível aqui). Conferi cada item contra o código atual.

| Item antigo | Status agora | Evidência |
|---|---|---|
| **MAINT-03** — idioma/região não sincronizava entre abas | **Corrigido.** Listener de `storage` no `LanguageContext`, atualiza idioma e país quando outra aba muda. | `LanguageContext.tsx:91-104` |
| **MAINT-02** — dicionário sem checagem de paridade entre idiomas | **Corrigido.** Existe `translations.test.ts` com 3 testes: nenhuma chave vazia, todas as chaves em sincronia entre pt/en/ja, nenhum valor igual à própria chave (detecta fallback silencioso). | `src/data/translations.test.ts` |
| **I18N-01** — textos hardcoded em pt/en apareciam com japonês selecionado (exemplos citados: "Mais Vistos", "Try KimiClaw!", toast do `CountrySwitcher`) | **Os exemplos citados foram corrigidos.** Os três agora têm entrada própria nas 3 línguas: `featured.tab.vistos` → "Mais Vistos" / "Most Viewed" / "人気商品"; `kimiclaw.tryMe` → "Experimente o KimiClaw!" / "Try KimiClaw!" / "KimiClawを試す！"; o toast do `CountrySwitcher` usa `t('a11y.toast.countryChanged...')` em vez de string fixa. Não naveguei o site ao vivo em japonês para garantir que não sobrou nenhum outro ponto (a página de rastreamento citada no item antigo eu não confirmei especificamente) — mas o padrão geral (texto hardcoded fora do dicionário) parece ter sido varrido, e agora há teste automatizado para pegar chave nova sem tradução. | `translations.ts:197,638,1128,1569,2059,2502`; `CountrySwitcher.tsx:54-56` |
| **UX-06** — seletores de país/idioma sem estado acessível | **Corrigido.** `CountrySwitcher` e `LanguageSwitcher` agora têm `aria-haspopup`, `aria-expanded`, `aria-controls`, `aria-label` no botão e `aria-checked` em cada opção — padrão ARIA de menu completo. | `CountrySwitcher.tsx:70-109`, `LanguageSwitcher.tsx:49-71` |
| **UX-05** — assistente flutuante (KimiClaw) sem nome acessível no botão principal/fechar | **O problema citado está corrigido:** botão de abrir tem `aria-label={t('kimiclaw.title')}` e o de fechar tem `aria-label={t('kimiclaw.close')}`. Reparei que os ~13 outros botões dentro do painel de chat (ações rápidas, enviar, etc.) não têm `aria-label` — se algum for só ícone sem texto visível, ainda vale revisar, mas não confirmei visualmente quais têm texto ao lado. | `KimiClawAssistant.tsx:1283-1577` |
| **UX-04** — faixa promocional cortada no mobile | **Corrigido.** A faixa de confiança do topo agora roda em marquee contínuo no mobile (itens duplicados + `animate-marquee`), sem cortar texto; no desktop fica centralizada e cabe inteira. | `Header.tsx:104-130` |
| **UX-08** — cabeçalho denso no desktop | **Corrigido conforme a recomendação antiga.** Só Ofertas/Sorteio (se ativo)/Vlog (se ativo)/Frete ficam sempre visíveis; Como Funciona, Encomenda, Empresas e Sobre foram agrupados — exatamente o "Mais" que a auditoria de julho sugeriu. | `Header.tsx:68-82` |
| **UX-02** — hero dominava a rolagem no mobile (scroll hijacking) | **Corrigido.** `simplified = reduced || isMobile` desliga o pin+scrub horizontal do GSAP em qualquer tela <768px (e também quando `prefers-reduced-motion` está ativo) — o mobile já não participa mais da coreografia horizontal, cai num layout mais direto. | `CinematicHeroShelf.tsx:177-185` |
| **UX-01/UX-03** — hero domina a rolagem/hierarquia no desktop | **Não confirmei ao vivo.** O código ainda mantém pin+scrub do GSAP para desktop (`isMobile` falso), então a mecânica de scroll longo pode continuar lá — só um teste no navegador real mede quantos px isso ocupa hoje. Não tenho como abrir o site neste ambiente para medir. | `CinematicHeroShelf.tsx:205-218` |
| **MEDIA-01** — thumbnails do Vlog quebradas (404) | **Melhorado, não totalmente.** Toda imagem de thumbnail agora tem `onError` com fallback para `/placeholder.svg` — não aparece mais ícone de imagem quebrada. Mas os IDs de vídeo padrão (usados só quando o admin não cadastrou nada) continuam sendo os mesmos dois que davam 404 na auditoria antiga (`1xN5_p-lU0Y`, `S7R97sV1w8k`) — o vídeo em si ainda não existe, só a miniatura não quebra mais visualmente. | `Vlog.tsx:39-43,86-91,125-129,177-181` |
| **UX-07** — estados de carregamento vazios (`/promocao`, `/produtos`) | **Não conferi.** Ficou de fora desta passada por tempo; precisa navegação ao vivo para confirmar se ainda mostra tela vazia antes de carregar. |  |

## O que eu não conferi

Cobri login, cupons/promoções, carrinho abandonado, webhook Stripe e, na segunda parte, a maior parte do UI/UX antigo (UX-01 a UX-08, I18N-01, MEDIA-01, MAINT-02/03). Ficaram de fora: performance de bundle (PERF-01/02), a confirmação ao vivo de UX-01/UX-03/UX-07 (dependem de abrir o site num navegador, que não tenho neste ambiente), e os outros dois projetos misturados na mesma pasta (`backend/` — sistema de RH/folha de pagamento — e `sweet-japan-treats/`, que parece ser uma versão antiga/paralela do mesmo site).

Também não consegui rodar a suíte de testes (`npm test`) neste ambiente — o binário nativo do Rolldown instalado é para Windows e o sandbox aqui é Linux, então os testes falham por incompatibilidade de plataforma, não por bug no código. Vale rodar `npm test` direto na sua máquina para confirmar que os arquivos `*.test.js` relacionados (`stripe-webhook.test.js`, `coupon-eligibility.test.js`, `cart-recovery.test.js`, `orders.promo-reserve.test.js`) continuam passando.

## Resumo em uma frase

O núcleo financeiro (Stripe, cupons, promoção, estoque) está bem mais protegido do que a auditoria de julho descrevia, e a lista de UI/UX também encolheu bastante — quase todo item antigo tem correção real no código, com destaque para acessibilidade dos seletores e do assistente, marquee mobile e teste automático de paridade de tradução. O que sobrou de concreto: três pontos onde um erro de e-mail desaparece sem log, um campo de configuração morto (`perCpfLimit`), os IDs de vídeo padrão do Vlog (ainda mostram vídeo errado, só não quebram mais visualmente), e três itens de UI (UX-01, UX-03, UX-07) que só dá para confirmar navegando o site ao vivo.
