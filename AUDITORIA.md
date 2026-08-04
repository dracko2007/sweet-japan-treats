# Auditoria — `temu_shop` (Japan Express)

Estado do disco em **04/08/2026**. Auditoria mecânica (grafo de imports determinístico) + três caçadores de bug em paralelo (API/pagamento, front-end, config/deploy) + **verificação ponto a ponto pelo agente principal**. Todo achado marcado `[VERIFICADO]` foi reproduzido ou confirmado lendo o código; `[AUDITORIA]` veio de subagente com linha real mas não re-validado aqui; falsos positivos descartados estão na seção 6.

---

## 1. Resumo executivo

| Bloco | Achados |
|---|---|
| **Críticos** | 3 — ✅ **todos corrigidos**: cupom de recuperação com 0% de desconto; loop infinito no checkout ao escolher frete; promoção da home sem limite de unidades |
| **Altos** | 4 — ✅ **todos corrigidos**: pedido pago sem aviso; webhook Stripe que mascarava segredo errado; impersonação por e-mail no checkout de convidado; senha admin em texto puro |
| **Médios** | 4 — ✅ **todos corrigidos**: pontos de campanha nunca creditados; pontos não reservados; limites de promoção só valem com CPF; bônus de aniversário editável pelo cliente (a trava de API está no ar; a de `firestore.rules` depende de publicar o Grupo 2 — ver MEDIO 4) |
| **Baixos** | 2 — conta de subtotal não bate na tela; admin fallback hardcoded + comparação de cron não constante |
| **Arquivos mortos** | 52 (5.598 linhas) — ✅ **apagados** |
| **Dependências** | 29 não usadas — ✅ **removidas** do `package.json` |
| **Falsos positivos** | 3 — segredos **não** estão commitados (verificado histórico completo, 810 commits) |

Os três críticos foram reproduzidos por mim antes de entrarem aqui, e cada
correção tem teste de regressão provado por reversão (o teste falha sem o fix).
A suíte saiu de 283 para 330 testes.

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

> **Status (04/08/2026, após esta auditoria):** os 3 CRÍTICOS, os 4 ALTOS e os
> 4 MÉDIOS foram corrigidos e cobertos por teste de regressão — cada teste foi
> provado revertendo o fix e conferindo que ele falha. Ficam de fora os 2
> BAIXOS, as duas decisões de negócio, a publicação do Grupo 2 do
> `firestore.rules` (metade do MEDIO 4) e o `reservedCount` que sobrou do
> CRÍTICO 3 — todos no plano de ação. Detalhe em cada item abaixo.

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

### ALTO 2 — Webhook Stripe processa evento quando a assinatura falha `[VERIFICADO, severidade ajustada]` — ✅ **CORRIGIDO**

- **Onde:** `api/stripe-webhook.js:86-103`
- **Defeito:** o fallback é intencional e documentado — busca o evento na API do Stripe pelo `id` quando `constructEvent` falha (Vercel entrega o body já parseado, HMAC quebra). É mais fraco que assinatura: quem souber um `evt_...` real (vazado em log/export) dispara reprocessamento. **O defeito real é mascarar config errada**: `STRIPE_WEBHOOK_SECRET` errado faz todo o tráfego cair no fallback e ninguém percebe.
- **Correção aplicada:** `rawBody()` passou a devolver `{ bytes, autentico }` em vez de só os bytes. `autentico: false` é exclusivo do caso 3 da lista de preferência — a re-serialização com `JSON.stringify` do corpo já parseado pela Vercel, que é uma reconstrução, não a mensagem que o Stripe assinou. Os outros quatro caminhos (`req.rawBody` Buffer/string, `req.body` Buffer/string, leitura do stream) entregam os bytes originais e voltam `autentico: true`.
  - **Bytes autênticos + HMAC falhou → 400, sem fallback.** Não sobra outra explicação além de segredo errado, rotacionado sem atualizar a env var, ou requisição forjada. Antes esse caso caía calado no fallback, e a verificação de assinatura ficava desligada **para sempre** sem ninguém notar. O 400 é o alerta: o Stripe marca o endpoint como falhando no painel dele.
  - **Bytes reconstruídos + HMAC falhou → fallback, como antes.** Aqui falhar é esperado — basta um byte de diferença num objeto real de PaymentIntent. O fallback (`stripe.events.retrieve`) continua sendo mais forte que HMAC sobre bytes reconstruídos: lê o evento original na fonte, com a chave secreta.
  - O log dos dois ramos ficou distinguível (`assinatura falhou com bytes autênticos…` vs `assinatura falhou (corpo reconstruído pela plataforma)…`), que é o que permite medir a frequência do fallback sem instrumentar nada novo.
- **Regressão:** `stripe-webhook.test.js` — "rejeita com 400 quando os bytes são autênticos e a assinatura não confere" (corpo como `Buffer`) e "usa o fallback da API quando o corpo foi reconstruído pela plataforma" (corpo como objeto). O par trava a distinção nos dois sentidos. Provado: apagando o bloco `if (autentico)`, o primeiro falha — bytes autênticos com HMAC quebrado voltam a cair calados no fallback.

### ALTO 3 — Checkout anônimo deixa o cliente escolher o e-mail do pedido `[VERIFICADO o mecanismo]` — ✅ **CORRIGIDO (impersonação); resta 1 item de política**

- **Onde:** `api/orders.js:43-45` + `src/services/checkoutService.ts:66` (`signInAnonymously`)
- **Defeito:** token anônimo não tem `email` → `tokenEmail=''` → a checagem `if (tokenEmail && ...)` é pulada → `customer.email` vem do corpo. Esse e-mail é usado em `assertCouponEligibility` (cupom nominal) e no guarda `coupon_usage.usedBy` (cupom "1× por cliente").
- **Impacto:** cupom global de uso único vira ilimitado; cupom nominal de terceiro é resgatável por quem saber o endereço.
- **Correção aplicada:** `assertCouponEligibility` passou a receber `emailVerified` (padrão `false` — quem não passar falha fechado), alimentado por `user.email_verified` do token em `orders.js` e `coupons.js`:
  - **`specific`** (cupom nominal) exige e-mail **provado**. Era o vetor concreto: `cart-recovery.js:59` emite os cupons de 10/15/30% como `targetType: 'specific'`, então bastava digitar o e-mail da vítima para levar o desconto dela.
  - **`loyalty`** conta o histórico do `uid` **sempre**, e o do e-mail **só quando verificado**. Assim o convidado não herda a fidelidade de um cliente antigo, e quem tem histórico real no próprio uid não é punido.
  - A trava vale também para **conta registrada com e-mail não verificado** — dava para se cadastrar com o endereço de outra pessoa sem nunca abrir a caixa dela. Por isso a régua é `email_verified`, não "tem e-mail".
  - `birthday` já falhava fechado (depende de `userDoc`, buscado por uid) e `usageLimit` (teto **total**) nunca foi burlável por e-mail.
  - `coupons.js` usa a mesma régua, para a tela não anunciar desconto que o pedido vai recusar.
- **Não corrigido, por ser decisão de negócio:** o guarda `coupon_usage.usedBy` ("1× por cliente") continua ancorado em e-mail, então um convidado ainda pode reusar um cupom **público** trocando de endereço. Fechar isso significa **proibir convidado de usar cupom** — decisão de receita, não de código. Vale notar que a mesma reutilização já era possível com contas descartáveis, e que o guarda por CPF (`cpf_index`) continua valendo em qualquer caso.
- **Regressão:** `coupon-eligibility.test.js` — "recusa cupom nominal quando o e-mail não foi provado", "não deixa herdar fidelidade digitando o e-mail de um cliente antigo" e "mantém a fidelidade pelo histórico do próprio uid". Provado: revertendo o fix, os dois primeiros falham.

### ALTO 4 — Senha de admin legada em texto puro no Firestore `[AUDITORIA]` — ✅ **CORRIGIDO**

- **Onde:** `api/admin.js:207-210,255-260` (`passwordMatches` faz SHA-256 dos dois lados, o que só funciona se `admins/{user}.password` for a senha em claro)
- **Impacto:** dump do Firestore entrega o painel. Documentos legados só migram quando o admin loga.
- **Medição antes de mexer:** a coleção `admins` foi consultada em produção (`localstorage-98492`, 04/08/2026): **0 documentos**. E `createAdmin` nunca gravou `password` — cria a conta no Firebase Auth e guarda só `authEmail`. Ou seja, não havia senha em claro para migrar: o caminho já era **código morto**.
- **Correção aplicada:** corte limpo, sem script de migração (não havia o que migrar). Removidos `passwordMatches`, `digest`, `migrateLegacyAdmin` e o import de `timingSafeEqual`; `authenticate` ficou só com `migratedAdmin`. Saiu junto `adminEmail`, que era byte a byte igual a `authEmail`. O que restava de pé era um leitor de senha em claro esperando alguém restaurar um backup antigo por cima.
- **Regressão:** `admin-session.test.js` — o teste que exercitava a migração legada foi **substituído** por dois que defendem o contrato novo: doc legado com senha em claro é recusado **mesmo com a senha certa**, sem criar conta no Firebase Auth e sem escrever nada.

### MEDIO 1 — Campanha com mecânica `points` nunca credita ponto nenhum `[VERIFICADO]` — ✅ **CORRIGIDO**

- **Onde:** `api/_lib/fulfillment.js:203` lê `order.promoPoints`; o campo não é gravado em `orders.js:404-425` nem em `buildQuote`. Só existe no teste (`fulfillment.test.js:79`, sempre 0).
- **Impacto:** campanha "ganhe N pontos" anunciada por e-mail/push credita zero.
- **Correção aplicada:** `buildQuote` passou a devolver `promoPoints` (`commerce.js:326-329`) e `handleCreate` grava `promoPoints: quote.promoPoints` no pedido (`orders.js:437`). O cálculo mora na cotação, e não em `orders.js`, porque é lá que ficam as outras mecânicas e é a cotação que o servidor trata como autoritativa.
- **A regra exige o produto da campanha no carrinho.** As outras mecânicas já fazem isso — `discount` casa por `productId`, `bogo` procura o item gatilho —, e sem isso bastaria colar o código com um carrinho qualquer para levar os pontos. Brinde (`freeGift`) não conta como gatilho, pelo mesmo motivo: o brinde vem *da* campanha, não a dispara.
- **Regressão:** `commerce.test.js` — 4 testes: credita quando o produto da campanha está no carrinho, não credita quando não está, não credita em campanha de outra mecânica, e pedido sem campanha dá 0. Provado com **duas** reversões, uma para cada metade da regra: zerando `promoPoints`, o teste que credita falha (os três "não credita" seguem passando, porque 0 é justamente o que o bug produzia); tirando a exigência do produto no carrinho, é "não credita se o produto da campanha não está no carrinho" que falha.

### MEDIO 2 — Pontos não são reservados na criação do pedido `[AUDITORIA]` — ✅ **CORRIGIDO**

- **Onde:** `api/orders.js:342-343` (checa fora de transação) vs `api/_lib/fulfillment.js:138-139` (debita só no fulfillment).
- **Defeito:** o mesmo saldo lastreira N pedidos simultâneos. O primeiro pago debita; os outros estouram `insufficient_points` depois de cobrados.
- **Correção aplicada:** módulo novo `api/_lib/points-hold.js`, com a reserva gravada **no próprio documento do usuário** (`users/{uid}.pointsHolds`), dentro da transação que cria o pedido:
  - **A reserva mora no doc do usuário de propósito.** Só assim o Firestore serializa: duas transações que escrevem o MESMO documento entram em contenção e uma delas repete a leitura. Uma coleção `points_holds` à parte não resolveria nada — cada transação criaria o seu doc sem enxergar o da outra, e o saldo continuaria furado.
  - **Toda reserva tem prazo (24h).** Não existe endpoint de cancelamento de pedido no servidor; sem prazo, um checkout abandonado seguraria os pontos do cliente para sempre. Reserva vencida é ignorada no cálculo e podada na escrita seguinte.
  - `pontosDisponiveis()` = saldo − reservas vigentes. Substitui `Number(userData.points)` na pré-checagem (`orders.js:358`, que existe só para o cliente ver o erro antes de qualquer cobrança) e é reavaliado **dentro** da transação, que é onde a palavra final é dada.
  - Fim de vida do pedido: pagou → `fulfillOrder` debita de verdade e tira da lista (`semReserva`); morreu em `payment_review` → `liberarReserva` devolve. Falhar ao liberar não derruba nada, porque o prazo cobre.
- **Regressão:** `points-hold.test.js` (7 testes, aritmética da reserva) e `orders.points-hold.test.js` (4 testes, a fiação em `handleCreate`). O caso central é "recusa quando o saldo já está reservado por outro pedido": saldo **bruto** suficiente, **disponível** insuficiente — exatamente a conta que o bug fazia errado. Provado: revertendo o fix, 3 dos 4 falham, e o caso central devolve 201 no lugar de 409.

### MEDIO 3 — Limites por pessoa das promoções só valem com CPF `[AUDITORIA]` — ✅ **CORRIGIDO**

- **Onde:** `api/orders.js:332-333`, `api/_lib/fulfillment.js:66-67` — `cpf_index` e `promo_usage` viram `null` sem CPF. CPF é opcional no checkout.
- **Impacto:** "1 por pessoa" e código de uso único viram ilimitados fora do Brasil (sem CPF).
- **Correção aplicada:** módulo novo `api/_lib/promo-identity.js` centraliza a âncora: CPF de 11 dígitos quando existe, senão `uid_<uid>`. Usado nos dois pontos que precisam concordar — a pré-checagem em `orders.js` e a baixa em `fulfillment.js`. Antes de existir, os dois montavam a chave à mão, e nada garantia que olhassem o mesmo documento.
- **`uid_` não colide com CPF:** `parseCustomer` só aceita CPF com exatamente 11 dígitos, então nenhum id de CPF começa com letra. As duas chaves convivem na mesma coleção e **nada do que já está gravado precisa migrar**.
- **É mais fraco que CPF, e isso é aceito:** conta é de graça, CPF não. Mas "guarda fraco" é incomparavelmente melhor que "guarda nenhum", e não custa nada para quem já informa o CPF. Quem quiser o rigor do CPF fora do Brasil tem que passar a exigi-lo no checkout — decisão de conversão, não de código.
- **Regressão:** `promo-identity.test.js` (8 testes, a âncora em si — inclusive CPF pontuado, CPF malformado e a não-colisão) e `fulfillment.test.js`, bloco "limite de promoção sem CPF" (4 testes, a fiação). Provado: revertendo a âncora para `order.cpf`, os dois casos sem CPF param de rejeitar e resolvem em vez de estourar 409.

### MEDIO 4 — Bônus de aniversário depende de campo editável pelo cliente `[AUDITORIA]` — ✅ **CORRIGIDO (uma das camadas ainda não está no ar)**

- **Onde:** `api/user-rewards.js:88-113` + `firestore.rules:119-124` (`birthdate` na lista `hasOnly` de campos que o dono altera).
- **Impacto:** qualquer conta muda `birthdate` para hoje e ganha 1.000 pts (≈ ¥1.000) por conta criada.
- **Correção aplicada, em duas camadas:**
  - **`firestore.rules`:** `birthdate` continua na lista de campos que o dono escreve, mas só **uma vez** — a regra passa se o campo não está sendo tocado, ou se ele ainda não existe no documento. Congelar em vez de proibir preserva o cadastro normal (quem nunca preencheu ainda preenche) e fecha a troca repetida.
  - **`api/user-rewards.js`:** idade mínima de conta de 30 dias para resgatar, lida do **Firebase Auth** (`adminAuth().getUser(uid).metadata.creationTime`), não do documento. Um campo que o cliente escreve não serve de trava — e a regra de congelamento sozinha não fecharia o caso da conta nova, criada já com a data certa.
  - **Data ilegível recusa em vez de liberar:** um `NaN` numa comparação de "menor que" passa batido e transformaria a trava em enfeite. Daí o `Number.isFinite` explícito.
- **Regressão:** `user-rewards.test.js` — 4 testes: recusa conta com menos de 30 dias, recusa quando não dá para saber a idade, credita 1.000 no primeiro resgate do ano de conta antiga, e não credita de novo quando `birthdayBonusYear` já é o ano corrente. Provado: revertendo o fix, os dois primeiros falham.
- **⚠️ A camada de regra ainda não está publicada.** `validUserUpdate` faz parte do **Grupo 2** do `firestore.rules`, que o cabeçalho do arquivo marca como não publicado (o ruleset no ar é cirúrgico). Ou seja: em produção o `birthdate` continua editável pelo dono. O que **está** no ar depois deste commit é a idade mínima de conta, que é código de API — e é ela que fecha o vetor real ("cria conta, aponta a data para hoje, saca 1.000 pts, repete por conta nova"). O que sobra até a regra subir é uma conta com mais de 30 dias antecipar o próprio bônus mudando a data — `birthdayBonusYear` já limita a 1× por ano civil, então o teto do abuso é adiantar um bônus que a conta ganharia de qualquer forma. Publicar o Grupo 2 exige o teste fluxo a fluxo descrito no cabeçalho do arquivo; até lá, não rode `firebase deploy --only firestore:rules`.

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
6. ✅ Impersonação por e-mail em cupom nominal e de fidelidade (ALTO 3) — `coupon-eligibility.js`, com 3 regressões.
7. ✅ Remoção do caminho de senha em claro do admin (ALTO 4) — `admin.js`, com 2 regressões substituindo a do fluxo antigo.
8. ✅ 400 em vez de fallback silencioso quando a assinatura falha com bytes autênticos (ALTO 2) — `stripe-webhook.js`, com 2 regressões.
9. ✅ `promoPoints` gravado no pedido (MEDIO 1) — `commerce.js` / `orders.js`, com 4 regressões.
10. ✅ Reserva de pontos na transação de criação (MEDIO 2) — `points-hold.js` novo, `orders.js` / `fulfillment.js`, com 11 regressões.
11. ✅ Âncora de limite de promoção que funciona sem CPF (MEDIO 3) — `promo-identity.js` novo, `orders.js` / `fulfillment.js`, com 12 regressões.
12. ✅ `birthdate` congelado após a primeira gravação + idade mínima de conta (MEDIO 4) — `firestore.rules` / `user-rewards.js`, com 4 regressões. A metade de API já está no ar; a regra depende de publicar o Grupo 2.

### Restante, por prioridade

1. **Decisão de negócio, pendente de você (ALTO 1):** o estorno em si continua manual, pelo painel do Stripe — o e-mail da loja já leva o link direto. As duas alternativas, se quiser automatizar:
   - *Estorno automático* nos 409: resolve na hora, mas é irreversível e tira da loja a chance de salvar a venda (estoque parcial, cupom vencido — casos em que hoje se negocia com o cliente).
   - *`capture_method: 'manual'`*: autoriza no checkout e só captura depois do `fulfillOrder`. Elimina a classe inteira do problema, mas **quebra métodos assíncronos** — hoje o checkout usa `automatic_payment_methods`, e PIX/konbini não suportam captura manual. Exigiria ramificar por método.
2. **Decisão de negócio, pendente de você (ALTO 3):** convidado ainda pode reusar cupom **público** trocando de e-mail, porque o guarda "1× por cliente" é ancorado em endereço. Fechar = **proibir convidado de usar cupom**. A impersonação (cupom nominal / fidelidade de terceiro) já está fechada.
3. **Publicação pendente (MEDIO 4):** o congelamento do `birthdate` está no `firestore.rules` mas o Grupo 2 (`users`) nunca foi publicado — o ruleset no ar é cirúrgico, e `firebase deploy --only firestore:rules` sobe tudo de uma vez, inclusive o Grupo 4, que quebra o "Confirmar Recebimento" do cliente. Ou se testa fluxo a fluxo, ou se publica só esse bloco pela API de rulesets (`publish-rules.cjs`).
4. **Esta semana:** subir `strict:true` no `tsconfig.app.json` e limpar os erros — vai revelar mais defeitos do tipo "pode ser undefined".
5. **Aberto, com o desenho já levantado (resto do CRÍTICO 3):** `buildQuote` já desconta `homePromotion.reservedCount` do saldo da promoção, mas **ninguém grava esse campo** — a corrida entre dois checkouts na última unidade continua existindo, e agora cai no aviso do ALTO 1 em vez de falhar calada. O reparo não é gravar um contador: `siteContent/homePromotion` é **público para leitura** (`firestore.rules:181-184`) e é **sobrescrito inteiro** pelo painel (`PromotionManager.tsx:204,224,261,287`) e por `Promotion.tsx:63`. Um contador ali seria zerado por qualquer salvamento do admin, e uma lista de reservas com prazo — que é o desenho certo, o mesmo de `points-hold.js` — vazaria ids de pedido para o navegador. Fazer direito exige um doc **só do servidor** (ex.: `promo_state/homePromotion`, sem acesso pelas regras), lido junto com a promoção na cotação e escrito na transação de criação, com a mesma poda por prazo dos pontos. Enquanto isso não existe, o campo `reservedCount` fica valendo 0 e a segunda linha de defesa é a trava atômica de `fulfillment.js:129`.
6. **Quando tocar o arquivo:** remover exports órfãos, não criar novo.

---

## Apêndice — exports órfãos completos (47)

`catalogShipping:catalogWeightG` · `japanPostRates:getKozutsumiRate` · `pricing:variantById` · `romanize:{romanizeJapanese,addAddressHintsSync,formatCityAddress}` · `shippingDimensions:{addSafetyMargin,fallbackBoxesFromSmallEquivalent}` · `sku:{categoryCode,skuPrefix,isValidSku,assignSkus}` · `taxRules:{BRAZIL_TAX,ICMS_BY_UF,ufFromCep,calcEuVat}` · `validation:{isValidJapanesePostalCode,maskJapanesePostalCode}` · `types/review:calculateReviewPoints` · `fxService:FX_BUFFER_YEN` · `mailService:sendConfirmationEmail` · `waServerService:{msgPaymentConfirmed,msgPreparing,msgShipped}` · `use-toast:reducer` · `useCookieConsent:setCookieConsent` · `europePrefectures:europeShippingRates` · `prefectures:shippingRates` · `worldCountries:FALLBACK_CONFIG` · `UserContext:makeWelcomeCoupon` · `ui/alert:AlertTitle` · `ui/badge:badgeVariants` · `ui/card:CardFooter` · `ui/dialog:{DialogPortal,DialogOverlay,DialogClose,DialogTrigger}` · `ui/toast:ToastAction` · `api/admin:handleUsers` · `cart-recovery-profile:recordPurchaseDiscount` · `firebase-admin:adminApp` · `firestore-products:{parseValue,parseFields}` · `mailer:BRAND` · `order-analytics:orderDateCursorValue` · `shared/points:{SPEND_WINDOW_MONTHS,isPaidLoyaltyOrder}`

*Nota: exports de componentes `ui/` mortos (seção 2.2) somam outros órfãos que somem junto quando os arquivos forem apagados.*
