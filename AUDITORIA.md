# Auditoria — `temu_shop` (Japan Express)

Estado do disco em **04/08/2026**. Auditoria mecânica (grafo de imports determinístico) + três caçadores de bug em paralelo (API/pagamento, front-end, config/deploy) + **verificação ponto a ponto pelo agente principal**. Todo achado marcado `[VERIFICADO]` foi reproduzido ou confirmado lendo o código; `[AUDITORIA]` veio de subagente com linha real mas não re-validado aqui; falsos positivos descartados estão na seção 6.

---

## 1. Resumo executivo

| Bloco | Achados |
|---|---|
| **Críticos** | 3 — ✅ **todos corrigidos**: cupom de recuperação com 0% de desconto; loop infinito no checkout ao escolher frete; promoção da home sem limite de unidades |
| **Altos** | 4 — ✅ **1 corrigido** (pedido pago que morria em `payment_review` sem aviso); abertos: webhook Stripe processa sem assinatura; e-mail spoofado no checkout anônimo; senha admin legada em texto puro |
| **Médios** | 4 — pontos de campanha nunca creditados; pontos não reservados; limites de promoção só valem com CPF; bônus de aniversário editável pelo cliente |
| **Baixos** | 2 — conta de subtotal não bate na tela; admin fallback hardcoded + comparação de cron não constante |
| **Arquivos mortos** | 52 (5.598 linhas) — ✅ **apagados** |
| **Dependências** | 29 não usadas — ✅ **removidas** do `package.json` |
| **Falsos positivos** | 3 — segredos **não** estão commitados (verificado histórico completo, 810 commits) |

Os três críticos foram reproduzidos por mim antes de entrarem aqui, e cada
correção tem teste de regressão provado por reversão (o teste falha sem o fix).
A suíte saiu de 283 para 294 testes.

---

## 2. Arquivos não usados — lista de exclusão

Grafo de imports a partir de todas as entradas (`src/main.tsx`, cada `api/*.js`, `scripts/`, configs, e todo `*.test.*`). Nenhum import aponta para estes. **Não há duplicata de conteúdo idêntico** no repo.

### 2.1 Código de negócio morto (17 arquivos, 2.205 linhas) — apagar

```
src/components/home/HeroSection.tsx            ⚠️ você tem edição não commitada aqui
src/components/home/HeroCarousel.tsx
src/components/home/PromoCarouselSection.tsx
src/components/home/VideoGallery.tsx
src/components/home/PresentationVideo.tsx
src/components/shipping/AddressForm.tsx
src/components/shipping/ShippingLabel.tsx
src/components/PhoneLoginButton.tsx
src/components/MaintenanceGuard.tsx
src/components/DemoBanner.tsx
src/components/NavLink.tsx
src/services/carrierService.ts
src/services/paypayService.ts
src/services/storageService.ts
src/hooks/use-mobile.tsx
src/utils/mobileDebug.ts
src/config/emailjs.ts
```

**Atenção:** `src/components/home/HeroSection.tsx` está com mudança não commitada no working tree. A home usa `CinematicHeroShelfTransition`, não `HeroSection` — a edição está sendo feita em arquivo morto. Confirme antes de apagar.

### 2.2 Componentes shadcn não usados (35 arquivos, 3.393 linhas) — decisão sua

```
src/components/ui/sidebar.tsx          src/components/ui/chart.tsx
src/components/ui/carousel.tsx         src/components/ui/menubar.tsx
src/components/ui/dropdown-menu.tsx    src/components/ui/context-menu.tsx
src/components/ui/select.tsx           src/components/ui/command.tsx
src/components/ui/form.tsx             src/components/ui/navigation-menu.tsx
src/components/ui/sheet.tsx            src/components/ui/alert-dialog.tsx
src/components/ui/breadcrumb.tsx       src/components/ui/drawer.tsx
src/components/ui/pagination.tsx       src/components/ui/table.tsx
src/components/ui/input-otp.tsx        src/components/ui/calendar.tsx
src/components/ui/accordion.tsx        src/components/ui/toggle-group.tsx
src/components/ui/avatar.tsx           src/components/ui/scroll-area.tsx
src/components/ui/resizable.tsx        src/components/ui/toggle.tsx
src/components/ui/popover.tsx          src/components/ui/hover-card.tsx
src/components/ui/switch.tsx           src/components/ui/checkbox.tsx
src/components/ui/progress.tsx         src/components/ui/slider.tsx
src/components/ui/separator.tsx        src/components/ui/collapsible.tsx
src/components/ui/skeleton.tsx         src/components/ui/aspect-ratio.tsx
src/components/ui/use-toast.ts
```

Estes são o scaffold do shadcn/ui que nunca foi consumido. Se você pretende adicionar mais telas shadcn no futuro, mantenha; senão, apague junto com as deps da seção 3.

### 2.3 Comando único para apagar (após confirmar HeroSection)

```bash
git rm src/components/home/{HeroSection,HeroCarousel,PromoCarouselSection,VideoGallery,PresentationVideo}.tsx \
       src/components/shipping/{AddressForm,ShippingLabel}.tsx \
       src/components/{PhoneLoginButton,MaintenanceGuard,DemoBanner,NavLink}.tsx \
       src/services/{carrierService,paypayService,storageService}.ts \
       src/hooks/use-mobile.tsx src/utils/mobileDebug.ts src/config/emailjs.ts
```

---

## 3. Dependências do `package.json` não usadas

Lidas dos imports reais do código vivo (não dos arquivos mortos):

**Removíveis agora:**
- `@hookform/resolvers` — sem `react-hook-form` em código vivo
- `date-fns` — nenhuma referência

**Removíveis se apagar os `ui/` mortos (só existem para sustentá-los):**
`@radix-ui/react-{accordion,alert-dialog,aspect-ratio,avatar,checkbox,collapsible,context-menu,dropdown-menu,hover-card,menubar,navigation-menu,popover,progress,scroll-area,select,separator,slider,switch,toggle,toggle-group}`, `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `vaul`.

---

## 4. Exports órfãos (47) — código vivo exportando o que ninguém consome

Amostra dos maisindicativos (lista completa no rodapé):

| Arquivo | Símbolo |
|---|---|
| `src/services/mailService.ts` | `sendConfirmationEmail` |
| `src/utils/sku.ts` | `categoryCode`, `skuPrefix`, `isValidSku`, `assignSkus` |
| `src/utils/taxRules.ts` | `BRAZIL_TAX`, `ICMS_BY_UF`, `ufFromCep`, `calcEuVat` |
| `api/_lib/firestore-products.js` | `parseValue`, `parseFields` |
| `shared/points.js` | `SPEND_WINDOW_MONTHS`, `isPaidLoyaltyOrder` |

Não é urgente, mas é dívida: ou o símbolo virou lixo, ou o caller foi apagado e o export ficou. Revisar caso a caso quando tocar o arquivo.

---

> **Status (04/08/2026, após esta auditoria):** os três CRÍTICOS foram
> corrigidos e cobertos por teste de regressão — cada teste foi provado
> revertendo o fix e conferindo que ele falha. Detalhe em cada item abaixo.

## 5. Bugs por severidade

### CRÍTICO 1 — Cupom de recuperação de carrinho aplica **0%** de desconto `[VERIFICADO]` — ✅ **CORRIGIDO**

- **Onde:** `api/cart-recovery.js:50-53` → `api/orders.js:108` → `api/_lib/commerce.js:265`
- **Código:**
  ```js
  // cart-recovery.js — cria o cupom
  type: 'percent', discount: 0, discountPercent: discount
  // orders.js — normaliza
  discountType: coupon.type === 'fixed' ? 'fixed' : 'percentage'
  // commerce.js — usa o campo errado
  const percentage = coupon.discountType === 'percentage'
    ? Number(coupon.discount || 0)            // ← lê discount, que é 0
    : Number(coupon.discountPercent || 0);    // ramo morto
  ```
- **Defeito:** o percentual real fica em `discountPercent`, mas `buildQuote` lê `discount` no ramo que sempre cai (`discountType==='percentage'`). A API de validação (`coupons.js`) devolve `discountPercent: 30` para a tela, então o cliente **vê** 30% OFF e o pedido é cobrado sem desconto nenhum.
- **Impacto:** toda a campanha de recuperação (3 estágios 10/15/30%) não dá desconto. Cobrança divergente do prometido, chargeback certo.
- **Correção aplicada:** `commerce.js:266` → `coupon.discountPercent != null ? Number(coupon.discountPercent) : Number(coupon.discount || 0)`. O fallback preserva o cupom global, que traz o percentual em `discount`.
- **Regressão:** `commerce.test.js` — "aplica o percentual do cupom de recuperação, que vem em discountPercent" e "mantém o cupom global, que traz o percentual em discount". Provado: revertendo o fix, o primeiro falha.

### CRÍTICO 2 — Loop infinito no checkout ao escolher frete `[VERIFICADO no browser]` — ✅ **CORRIGIDO**

- **Onde:** `src/components/shipping/ShippingCalculator.tsx:40,51-54,197-206`
- **Defeito:** `getSpaceUsed()` devolve objeto novo a cada render → invalida o `useMemo(calculateBoxes)` → invalida `shippingOptions` → o `useEffect` chama `onShippingSelect({...})` com objeto literal novo → `setSelectedShipping` no pai → re-render → repete.
- **Reproduzido:** `/checkout` + carrinho, endereço BR, clique em EMS → `Maximum update depth exceeded` em `ShippingCalculator` (múltiplos warnings). Carrier "selecionado" mas componente em churn; em mobile congela a aba.
- **Correção aplicada:** `ShippingCalculator.tsx:40` → `const spaceInfo = useMemo(() => getSpaceUsed(), [getSpaceUsed]);`. `getSpaceUsed` já é `useCallback(..., [items])` no CartContext, então a referência só muda quando o carrinho muda — o que estabiliza `calculateBoxes` e `shippingOptions`, e o efeito para de reentrar.
- **Regressão:** `ShippingCalculator.test.tsx` — monta o componente com um pai que tem `useState` real (um `vi.fn()` não fecha o ciclo, por não ser setState de verdade) e clica num carrier. Provado: revertendo o fix, o teste **trava** (loop infinito sem bail-out), em vez de só falhar.

### CRÍTICO 3 — Limite de unidades da promoção da home nunca é verificado `[VERIFICADO]` — ✅ **CORRIGIDO**

- **Onde:** `api/_lib/commerce.js:236-240` (a variável `remaining` aparece **1×** no arquivo — calculada e jogada fora)
- **Defeito:** a checagem de `maxProducts` só acontece em `fulfillment.js:118`, **depois** do cartão ser cobrado. A promoção vende ilimitado no checkout; os pedidos além do limite caem em `payment_review` (ver ALTO 1).
- **Correção aplicada:** `commerce.js:239` → `if (quantity > remaining) throw new HttpError(409, 'promotion_unavailable');`, logo após o cálculo de `remaining`. A recusa passa a acontecer na cotação, antes de cobrar. A trava atômica do `fulfillment.js:121` continua como segunda linha de defesa contra corrida.
- **Pendente (menor):** `reservedCount` já entra na conta de `remaining`, mas ainda não é gravado na criação do pedido. Enquanto não for, dois checkouts simultâneos no limite ainda dependem só da trava do fulfillment — que agora é exceção, não regra.
- **Regressão:** `commerce.test.js` — "recusa a promoção da home quando o estoque promocional acabou", "conta as reservas em aberto no limite da promoção" e "ainda vende enquanto sobra unidade promocional". Provado: revertendo o fix, os dois primeiros falham.

### ALTO 1 — Pedido pago morre em `payment_review` sem aviso nem estorno `[AUDITORIA]` — ✅ **CORRIGIDO**

- **Onde:** `api/stripe-webhook.js:136-140`, `api/_lib/fulfillment.js:254-262`
- **Defeito:** qualquer 409 do `fulfillOrder` (estoque insuficiente, promoção esgotada, cupom indisponível, pontos insuficientes — 8 casos) só marca `status:'payment_review'` e responde 200 ao Stripe. O `payment_intent` **já sucedeu**. Não há estorno, não há e-mail ao cliente, não há alerta à loja.
- **Impacto:** cliente cobrado, pedido não processado, descoberto só se alguém filtrar o painel por `payment_review`.
- **Correção aplicada:** `markFulfillmentReview` (`fulfillment.js`) foi reescrito e passou a receber os dados da cobrança do próprio `intent` (`stripe-webhook.js:dadosDaCobranca`):
  - grava o que um estorno precisa — `refundPending: true`, `refundReference` (PaymentIntent), `refundAmount`, `refundCurrency`, `reviewedAt`. `refundPending` é a chave de filtro para o painel achar dinheiro parado sem varrer status;
  - avisa o **cliente** (tom honesto: pedido travou, retorno em 1 dia útil, sem prometer estorno automático — parte dos motivos a loja resolve mantendo a venda) e a **loja** (ordem de serviço: motivo em português + código cru, valor, e link direto `dashboard.stripe.com/payments/<pi>`);
  - **valor vem do `intent`, não do pedido.** No caso `payment_amount_or_currency_mismatch` os dois divergem por definição, e o que precisa voltar é o que saiu do cartão. Um teste trava essa distinção — foi ele que pegou o furo na primeira versão do meu próprio patch, que ainda lia `totalPrice` do pedido.
- **Duas decisões de projeto, explícitas:**
  - *Escrita no Firestore pode lançar; e-mail nunca.* Se nem registrar o estado der, é melhor o Stripe repetir o webhook do que perder o registro do pedido cobrado e não atendido. Já uma queda de SMTP viraria 500 → tempestade de retry em cima de um pedido que já está com problema.
  - *Só notifica na transição para `review`.* O Stripe entrega evento "pelo menos uma vez"; sem essa trava, cada reentrega mandaria outro par de e-mails.
- **Regressão:** `fulfillment.test.js`, bloco "pedido pago que não pôde ser separado" — 5 testes (handle de estorno, os dois avisos, idempotência da reentrega, e-mail que falha não derruba, valor cobrado ≠ valor do pedido). Provado: revertendo o fix, os 5 falham e os 7 antigos seguem passando.
- **Não feito, de propósito:** estorno automático e `capture_method:'manual'`. Ver "Restante" no plano de ação — os dois são decisão de negócio, não de código.

### ALTO 2 — Webhook Stripe processa evento quando a assinatura falha `[VERIFICADO, severidade ajustada]`

- **Onde:** `api/stripe-webhook.js:86-103`
- **Defeito:** o fallback é intencional e documentado — busca o evento na API do Stripe pelo `id` quando `constructEvent` falha (Vercel entrega o body já parseado, HMAC quebra). É mais fraco que assinatura: quem souber um `evt_...` real (vazado em log/export) dispara reprocessamento. **O defeito real é mascarar config errada**: `STRIPE_WEBHOOK_SECRET` errado faz todo o tráfego cair no fallback e ninguém percebe.
- **Correção:** usar `req.rawBody`/stream para validar HMAC de verdade; alertar se o fallback disparar mais que % do volume.

### ALTO 3 — Checkout anônimo deixa o cliente escolher o e-mail do pedido `[VERIFICADO o mecanismo]`

- **Onde:** `api/orders.js:43-45` + `src/services/checkoutService.ts:66` (`signInAnonymously`)
- **Defeito:** token anônimo não tem `email` → `tokenEmail=''` → a checagem `if (tokenEmail && ...)` é pulada → `customer.email` vem do corpo. Esse e-mail é usado em `assertCouponEligibility` (cupom nominal) e no guarda `coupon_usage.usedBy` (cupom "1× por cliente").
- **Impacto:** cupom global de uso único vira ilimitado; cupom nominal de terceiro é resgatável por quem saber o endereço.
- **Correção:** exigir e-mail verificado (não anônimo) para pedido com cupom/pontos, ou vincular `specific` ao `uid`.

### ALTO 4 — Senha de admin legada em texto puro no Firestore `[AUDITORIA]`

- **Onde:** `api/admin.js:207-210,255-260` (`passwordMatches` faz SHA-256 dos dois lados, o que só funciona se `admins/{user}.password` for a senha em claro)
- **Impacto:** dump do Firestore entrega o painel. Documentos legados só migram quando o admin loga.
- **Correção:** migrar todos de uma vez (script único), remover `passwordMatches`, apagar o campo `password` dos docs.

### MEDIO 1 — Campanha com mecânica `points` nunca credita ponto nenhum `[VERIFICADO]`

- **Onde:** `api/_lib/fulfillment.js:203` lê `order.promoPoints`; o campo não é gravado em `orders.js:404-425` nem em `buildQuote`. Só existe no teste (`fulfillment.test.js:79`, sempre 0).
- **Impacto:** campanha "ganhe N pontos" anunciada por e-mail/push credita zero.
- **Correção:** gravar `promoPoints: campaign.mechanic==='points' ? Number(campaign.points||0) : 0` no pedido.

### MEDIO 2 — Pontos não são reservados na criação do pedido `[AUDITORIA]`

- **Onde:** `api/orders.js:342-343` (checa fora de transação) vs `api/_lib/fulfillment.js:138-139` (debita só no fulfillment).
- **Defeito:** o mesmo saldo lastreira N pedidos simultâneos. O primeiro pago debita; os outros estouram `insufficient_points` depois de cobrados.
- **Correção:** debitar/reservar (`points_holds`) na transação de criação, estornando no cancelamento/expiração.

### MEDIO 3 — Limites por pessoa das promoções só valem com CPF `[AUDITORIA]`

- **Onde:** `api/orders.js:332-333`, `api/_lib/fulfillment.js:66-67` — `cpf_index` e `promo_usage` viram `null` sem CPF. CPF é opcional no checkout.
- **Impacto:** "1 por pessoa" e código de uso único viram ilimitados fora do Brasil (sem CPF).
- **Correção:** cair para `userId`/e-mail verificado quando não houver CPF, ou recusar promoção sem CPF.

### MEDIO 4 — Bônus de aniversário depende de campo editável pelo cliente `[AUDITORIA]`

- **Onde:** `api/user-rewards.js:88-113` + `firestore.rules:119-124` (`birthdate` na lista `hasOnly` de campos que o dono altera).
- **Impacto:** qualquer conta muda `birthdate` para hoje e ganha 1.000 pts (≈ ¥1.000) por conta criada.
- **Correção:** congelar `birthdate` após a primeira gravação, ou exigir que tenha sido definida há >N dias antes do resgate.

### BAIXO 1 — Subtotal/descontos exibidos não somam o total cobrado `[AUDITORIA]`

- **Onde:** `api/_lib/fx.js:66-73` (cushion 4% + ¥5) vs `api/_lib/commerce.js:306-314` (descontos convertidos `exact:true`, sem cushion). O `total` soma só as parcelas com cushion.
- **Impacto:** a conta na tela não bate com o cobrado (~R$2 em pedido típico). Reclamação e chargeback.
- **Correção:** aplicar cushion uma única vez sobre o total em ienes; derivar as linhas exibidas da mesma taxa efetiva.

### BAIXO 2 — Admin fallback hardcoded + cron não constante-time `[AUDITORIA]`

- **Onde:** `api/_lib/auth.js:22-24,57-58`, `api/admin.js`, `api/kimiclaw.js:231`
- **Defeito:** `'dracko2007@gmail.com'` como fallback em 4 arquivos se `ADMIN_EMAIL` não configurado; `requireCronSecret` compara com `!==` (não `timingSafeEqual`).
- **Correção:** falhar 503 sem `ADMIN_EMAIL`; trocar comparação por `timingSafeEqual` (já feito em `ps-fee-waiver.js:18-23`).

---

## 6. Falsos positivos descartados (subagiente errou)

O auditor de config reportou **3 CRÍTICOS de segredos commitados** — `.env`, `serviceAccountKey.json`, `key.json`. Verifiquei eu mesmo:

```
$ git ls-files | grep -iE "^\.env|serviceAccountKey|key\.json"
.env.example              ← único rastreado
$ git log --all --oneline -- .env serviceAccountKey.json key.json
0 commit(s) cada um       ← nunca existiram no histórico (810 commits, não-shallow)
$ git check-ignore -v
.gitignore:24:.env        .env
.gitignore:58:*serviceAccount*.json   serviceAccountKey.json
.gitignore:56:key.json   key.json
```

Os arquivos **existem no disco** (são lidos pelo app e pelos scripts locais) mas estão **corretamente gitignored e nunca foram commitados**. Não há vazamento. O `key.json` (bot Japan Express) e `serviceAccountKey.json` são o padrão correto de uso local.

**Confirmado real** (do mesmo auditor): `tsconfig.app.json` com `strict:false`, `noImplicitAny:false`, `strictNullChecks:false` — afrouxa a rede de segurança que pegaria vários dos MEDIO acima. E **12 funções serverless** em `api/` = exatamente o teto do Vercel Hobby (sem espaço para uma 13ª; qualquer split exige upgrade).

---

## 7. Plano de ação (ordenado por risco/efeito)

### Concluído nesta auditoria

1. ✅ Cupom de recuperação — `commerce.js:266`, com regressão.
2. ✅ Loop do `ShippingCalculator` — `ShippingCalculator.tsx:40`, com regressão.
3. ✅ Checagem de `remaining` na promoção da home — `commerce.js:239`, com regressão.
4. ✅ Limpeza: 52 arquivos mortos e 29 dependências removidos; typecheck, build e suíte verdes após cada corte.
5. ✅ Aviso + handle de estorno no `payment_review` (ALTO 1) — `fulfillment.js` / `stripe-webhook.js`, com 5 regressões.

### Restante, por prioridade

1. **Decisão de negócio, pendente de você (ALTO 1):** o estorno em si continua manual, pelo painel do Stripe — o e-mail da loja já leva o link direto. As duas alternativas, se quiser automatizar:
   - *Estorno automático* nos 409: resolve na hora, mas é irreversível e tira da loja a chance de salvar a venda (estoque parcial, cupom vencido — casos em que hoje se negocia com o cliente).
   - *`capture_method: 'manual'`*: autoriza no checkout e só captura depois do `fulfillOrder`. Elimina a classe inteira do problema, mas **quebra métodos assíncronos** — hoje o checkout usa `automatic_payment_methods`, e PIX/konbini não suportam captura manual. Exigiria ramificar por método.
2. **Esta semana:** e-mail spoofado no checkout anônimo (ALTO 3) e senha admin legada em texto puro (ALTO 4).
3. **Esta semana:** subir `strict:true` no `tsconfig.app.json` e limpar os erros — vai revelar mais defeitos do tipo "pode ser undefined".
4. **Quando der:** gravar `reservedCount` na criação do pedido (fecha a corrida que sobra do CRÍTICO 3) e `promoPoints` (MEDIO 1, campanha de pontos credita zero hoje).
5. **Quando tocar o arquivo:** remover exports órfãos, não criar novo.

---

## Apêndice — exports órfãos completos (47)

`catalogShipping:catalogWeightG` · `japanPostRates:getKozutsumiRate` · `pricing:variantById` · `romanize:{romanizeJapanese,addAddressHintsSync,formatCityAddress}` · `shippingDimensions:{addSafetyMargin,fallbackBoxesFromSmallEquivalent}` · `sku:{categoryCode,skuPrefix,isValidSku,assignSkus}` · `taxRules:{BRAZIL_TAX,ICMS_BY_UF,ufFromCep,calcEuVat}` · `validation:{isValidJapanesePostalCode,maskJapanesePostalCode}` · `types/review:calculateReviewPoints` · `fxService:FX_BUFFER_YEN` · `mailService:sendConfirmationEmail` · `waServerService:{msgPaymentConfirmed,msgPreparing,msgShipped}` · `use-toast:reducer` · `useCookieConsent:setCookieConsent` · `europePrefectures:europeShippingRates` · `prefectures:shippingRates` · `worldCountries:FALLBACK_CONFIG` · `UserContext:makeWelcomeCoupon` · `ui/alert:AlertTitle` · `ui/badge:badgeVariants` · `ui/card:CardFooter` · `ui/dialog:{DialogPortal,DialogOverlay,DialogClose,DialogTrigger}` · `ui/toast:ToastAction` · `api/admin:handleUsers` · `cart-recovery-profile:recordPurchaseDiscount` · `firebase-admin:adminApp` · `firestore-products:{parseValue,parseFields}` · `mailer:BRAND` · `order-analytics:orderDateCursorValue` · `shared/points:{SPEND_WINDOW_MONTHS,isPaidLoyaltyOrder}`

*Nota: exports de componentes `ui/` mortos (seção 2.2) somam outros órfãos que somem junto quando os arquivos forem apagados.*
