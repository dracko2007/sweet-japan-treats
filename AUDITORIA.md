# Auditoria — `temu_shop` (Japan Express)

Estado do disco em **04/08/2026**. Auditoria mecânica (grafo de imports determinístico) + três caçadores de bug em paralelo (API/pagamento, front-end, config/deploy) + **verificação ponto a ponto pelo agente principal**. Todo achado marcado `[VERIFICADO]` foi reproduzido ou confirmado lendo o código; `[AUDITORIA]` veio de subagente com linha real mas não re-validado aqui; falsos positivos descartados estão na seção 6.

---

## 1. Resumo executivo

| Bloco | Achados |
|---|---|
| **Críticos** | 3 — ✅ **todos corrigidos**: cupom de recuperação com 0% de desconto; loop infinito no checkout ao escolher frete; promoção da home sem limite de unidades |
| **Altos** | 4 — ✅ **todos corrigidos**: pedido pago sem aviso; webhook Stripe que mascarava segredo errado; impersonação por e-mail no checkout de convidado; senha admin em texto puro |
| **Médios** | 4 — ✅ **todos corrigidos**: pontos de campanha nunca creditados; pontos não reservados; limites de promoção só valem com CPF; bônus de aniversário editável pelo cliente |
| **Baixos** | 2 — ✅ **todos corrigidos**: conta de subtotal não batia na tela; admin fallback hardcoded + comparação de cron não constante |
| **Arquivos mortos** | 52 (5.598 linhas) — ✅ **apagados** |
| **Dependências** | 29 não usadas — ✅ **removidas** do `package.json` |
| **Falsos positivos** | 3 — segredos **não** estão commitados (verificado histórico completo, 810 commits) |

Os três críticos foram reproduzidos por mim antes de entrarem aqui, e cada
correção tem teste de regressão provado por reversão (o teste falha sem o fix).
A suíte saiu de 283 para 381 testes, mais 77 checks de regra no emulador.

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

> **Status (04/08/2026, após esta auditoria):** os 11 bugs de código —
> 3 CRÍTICOS, 4 ALTOS, 4 MÉDIOS e 2 BAIXOS — estão corrigidos, cada um com
> teste de regressão provado por reversão. As duas decisões de negócio foram
> tomadas pelo dono e implementadas: estorno segue manual (ALTO 1) e o cupom de
> uso único passou a ser trancado por CPF (ALTO 3). As regras do Firestore
> estão publicadas e o repo bate byte a byte com produção. Fica aberta só a
> dívida de `strict:true` no `tsconfig.app.json`. Detalhe em cada item abaixo.

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
- **Corrida fechada em 04/08/2026** (era a última pendência deste item). `reservedCount` entrava na conta de `remaining` mas ninguém gravava, então dois checkouts na última unidade passavam os dois. Agora existe `api/_lib/promo-reserve.js`, no mesmo desenho do `points-hold.js`: lista de holds com prazo, gravada num doc **só do servidor** (`promo_state/homePromotion`, fechado a todo mundo em `firestore.rules`) e revalidada **dentro** da transação que cria o pedido.
  - **Não dá para guardar isso em `siteContent/homePromotion`**, que é o lugar óbvio: o doc é público para leitura (vazaria ids de pedido) e o painel o sobrescreve inteiro (`PromotionManager.tsx:204,224,261,287`), o que zeraria o contador a cada salvamento do admin.
  - **Prazo por método de pagamento:** 2h no cartão (o Stripe confirma em minutos) e 24h nos métodos que a loja confirma à mão. Um prazo único de 24h seguraria unidade de flash sale por um dia inteiro a cada checkout abandonado; 2h para todos não cobriria PIX/konbini.
  - A rodada da promoção entra na chave do estado (`productId|expiresAt`): quando o admin troca a promoção, as reservas da rodada anterior são ignoradas em vez de bloquear a nova.
- **Regressão da checagem:** `commerce.test.js` — "recusa a promoção da home quando o estoque promocional acabou", "conta as reservas em aberto no limite da promoção" e "ainda vende enquanto sobra unidade promocional". Provado: revertendo o fix, os dois primeiros falham.
- **Regressão da reserva:** `promo-reserve.test.js` (23 testes, aritmética) e `orders.promo-reserve.test.js` (5 testes, fiação). O que importa é o quinto: **"recusa quando a última unidade é tomada entre a cotação e a transação"** — ele move o estado na janela exata entre a leitura da cotação e a transação, que é a corrida de verdade. Os outros quatro passam já na pré-checagem e, sozinhos, deixavam apagar a revalidação atômica sem a suíte reclamar (verificado: revertendo só a transação, os 4 continuavam verdes). Provado: revertendo só a revalidação atômica, o quinto falha.

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
- **Estorno automático descartado em 04/08/2026, e o risco residual é menor do que esta auditoria supôs.** A loja é **dropship**: não há estoque próprio. Medido em produção (`localstorage-98492`, 308 produtos): **307 não têm sequer o campo `stock`** e o único que tem está `unlimited: true`. Como `commerce.js` e `fulfillment.js` só bloqueiam quando `stock.unlimited === false` **explicitamente**, a causa `insufficient_stock` — a mais citada das 8 que levam a `payment_review` — **nunca dispara hoje**. (O código de baixa de estoque é igualmente inerte, mas está correto: só escreve `stock.quantity` no caso explícito, então não corrompe os 307 produtos sem o campo.)
  - Das causas que sobravam, as duas com chance real de acontecer eram **pontos insuficientes** e **promoção esgotada** — e as duas foram fechadas nesta mesma leva pelas reservas (MEDIO 2 e resto do CRÍTICO 3), que agora recusam **na cotação, antes de cobrar**. O `payment_review` passou de desfecho provável a exceção.
  - Por isso o estorno segue **manual**, pelo painel do Stripe, com o e-mail da loja levando o link direto. Automatizar tiraria da loja a chance de salvar a venda num caso que hoje é raro, em troca de nada. `capture_method:'manual'` foi descartado pelo mesmo motivo, somado a quebrar PIX/konbini.

### ALTO 2 — Webhook Stripe processa evento quando a assinatura falha `[VERIFICADO, severidade ajustada]` — ✅ **CORRIGIDO**

- **Onde:** `api/stripe-webhook.js:86-103`
- **Defeito:** o fallback é intencional e documentado — busca o evento na API do Stripe pelo `id` quando `constructEvent` falha (Vercel entrega o body já parseado, HMAC quebra). É mais fraco que assinatura: quem souber um `evt_...` real (vazado em log/export) dispara reprocessamento. **O defeito real é mascarar config errada**: `STRIPE_WEBHOOK_SECRET` errado faz todo o tráfego cair no fallback e ninguém percebe.
- **Correção aplicada:** `rawBody()` passou a devolver `{ bytes, autentico }` em vez de só os bytes. `autentico: false` é exclusivo do caso 3 da lista de preferência — a re-serialização com `JSON.stringify` do corpo já parseado pela Vercel, que é uma reconstrução, não a mensagem que o Stripe assinou. Os outros quatro caminhos (`req.rawBody` Buffer/string, `req.body` Buffer/string, leitura do stream) entregam os bytes originais e voltam `autentico: true`.
  - **Bytes autênticos + HMAC falhou → 400, sem fallback.** Não sobra outra explicação além de segredo errado, rotacionado sem atualizar a env var, ou requisição forjada. Antes esse caso caía calado no fallback, e a verificação de assinatura ficava desligada **para sempre** sem ninguém notar. O 400 é o alerta: o Stripe marca o endpoint como falhando no painel dele.
  - **Bytes reconstruídos + HMAC falhou → fallback, como antes.** Aqui falhar é esperado — basta um byte de diferença num objeto real de PaymentIntent. O fallback (`stripe.events.retrieve`) continua sendo mais forte que HMAC sobre bytes reconstruídos: lê o evento original na fonte, com a chave secreta.
  - O log dos dois ramos ficou distinguível (`assinatura falhou com bytes autênticos…` vs `assinatura falhou (corpo reconstruído pela plataforma)…`), que é o que permite medir a frequência do fallback sem instrumentar nada novo.
- **Regressão:** `stripe-webhook.test.js` — "rejeita com 400 quando os bytes são autênticos e a assinatura não confere" (corpo como `Buffer`) e "usa o fallback da API quando o corpo foi reconstruído pela plataforma" (corpo como objeto). O par trava a distinção nos dois sentidos. Provado: apagando o bloco `if (autentico)`, o primeiro falha — bytes autênticos com HMAC quebrado voltam a cair calados no fallback.

### ALTO 3 — Checkout anônimo deixa o cliente escolher o e-mail do pedido `[VERIFICADO o mecanismo]` — ✅ **CORRIGIDO**

- **Onde:** `api/orders.js:43-45` + `src/services/checkoutService.ts:66` (`signInAnonymously`)
- **Defeito:** token anônimo não tem `email` → `tokenEmail=''` → a checagem `if (tokenEmail && ...)` é pulada → `customer.email` vem do corpo. Esse e-mail é usado em `assertCouponEligibility` (cupom nominal) e no guarda `coupon_usage.usedBy` (cupom "1× por cliente").
- **Impacto:** cupom global de uso único vira ilimitado; cupom nominal de terceiro é resgatável por quem saber o endereço.
- **Correção aplicada:** `assertCouponEligibility` passou a receber `emailVerified` (padrão `false` — quem não passar falha fechado), alimentado por `user.email_verified` do token em `orders.js` e `coupons.js`:
  - **`specific`** (cupom nominal) exige e-mail **provado**. Era o vetor concreto: `cart-recovery.js:59` emite os cupons de 10/15/30% como `targetType: 'specific'`, então bastava digitar o e-mail da vítima para levar o desconto dela.
  - **`loyalty`** conta o histórico do `uid` **sempre**, e o do e-mail **só quando verificado**. Assim o convidado não herda a fidelidade de um cliente antigo, e quem tem histórico real no próprio uid não é punido.
  - A trava vale também para **conta registrada com e-mail não verificado** — dava para se cadastrar com o endereço de outra pessoa sem nunca abrir a caixa dela. Por isso a régua é `email_verified`, não "tem e-mail".
  - `birthday` já falhava fechado (depende de `userDoc`, buscado por uid) e `usageLimit` (teto **total**) nunca foi burlável por e-mail.
  - `coupons.js` usa a mesma régua, para a tela não anunciar desconto que o pedido vai recusar.
- **Reuso de cupom público — decidido em 04/08/2026: trancar por CPF.** O guarda "1× por cliente" era ancorado só em e-mail, que o convidado troca de graça. A decisão do dono foi usar o CPF, que a aduana brasileira já exige de todo pedido para o Brasil; fora do Brasil não existe documento equivalente e o e-mail continua sendo a única âncora possível — risco aceito.
  - **O servidor passou a exigir o CPF quando o destino é o Brasil** (`orders.js` `parseCustomer`, erro `cpf_required`). O formulário já exigia (`Checkout.tsx` valida `isValidCPF` para Brasil, campo marcado "Obrigatório Aduana"), mas o servidor aceitava sem: chamar a API direto, ou um bug de front, furava a trava. **Não há atrito novo para o cliente legítimo** — só fecha o caminho de quem não passa pela tela.
  - **`coupon_usage` ganhou `usedByCpf`** ao lado do `usedBy`. Recusa se bater em qualquer um dos dois: o CPF fecha o buraco no Brasil, e o e-mail preserva todo o histórico já gravado — sem isso, todo cupom já consumido voltaria a valer. Pedido sem CPF não grava `''` na lista, senão o primeiro uso fora do Brasil trancaria o cupom para o mundo inteiro.
  - **Regressão:** `orders.cpf-guard.test.js` (3 testes: Brasil sem CPF recusa, CPF malformado dá o erro específico, fora do Brasil passa) e `fulfillment.test.js`, bloco "cupom global de uso único ancorado no CPF" (4 testes, incluindo o ataque exato — mesmo CPF com e-mail novo). Provado: revertendo cada guarda, o teste correspondente falha.
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

### MEDIO 4 — Bônus de aniversário depende de campo editável pelo cliente `[AUDITORIA]` — ✅ **CORRIGIDO E PUBLICADO**

- **Onde:** `api/user-rewards.js:88-113` + `firestore.rules:119-124` (`birthdate` na lista `hasOnly` de campos que o dono altera).
- **Impacto:** qualquer conta muda `birthdate` para hoje e ganha 1.000 pts (≈ ¥1.000) por conta criada.
- **Correção aplicada, em duas camadas:**
  - **`firestore.rules`:** `birthdate` continua na lista de campos que o dono escreve, mas só **uma vez** — a regra passa se o campo não está sendo tocado, ou se ele ainda não existe no documento. Congelar em vez de proibir preserva o cadastro normal (quem nunca preencheu ainda preenche) e fecha a troca repetida.
  - **`api/user-rewards.js`:** idade mínima de conta de 30 dias para resgatar, lida do **Firebase Auth** (`adminAuth().getUser(uid).metadata.creationTime`), não do documento. Um campo que o cliente escreve não serve de trava — e a regra de congelamento sozinha não fecharia o caso da conta nova, criada já com a data certa.
  - **Data ilegível recusa em vez de liberar:** um `NaN` numa comparação de "menor que" passa batido e transformaria a trava em enfeite. Daí o `Number.isFinite` explícito.
- **A trava dos 30 dias tem uma saída, e ela é necessária** (ajuste de 04/08/2026, levantado pelo dono). Do jeito que a correção nasceu, quem se cadastrava **no dia do próprio aniversário** — que é justamente quem se cadastrou por causa do brinde — batia na trava e só ganharia no ano seguinte. Trocar uma fraude por uma injustiça não é conserto. Agora conta com menos de 30 dias passa **se tiver uma compra paga**, via `isPaidLoyaltyOrder` (que era um dos exports órfãos da seção 4 e voltou a ter uso), contando também o pedido feito como convidado, que fica preso ao e-mail em vez do `uid`. Cadastro legítimo e golpista são indistinguíveis no dia; o que separa os dois é ter pagado um pedido — e ninguém paga um pedido de verdade para levar ¥1.000 de desconto. A consulta de pedidos só roda para conta nova, então cliente antigo não paga esse custo.
- **Regressão:** `user-rewards.test.js` — 7 testes: recusa conta com menos de 30 dias, recusa quando não dá para saber a idade, credita no primeiro resgate do ano de conta antiga, não credita de novo no mesmo ano, **libera na hora para conta nova com compra paga**, pedido não pago não destrava, e a compra feita como convidado conta pelo e-mail. Provado: revertendo o fix da idade, os dois primeiros falham; tirando a saída por compra paga, os dois últimos falham.
- **Publicada em 04/08/2026.** O aviso do cabeçalho do `firestore.rules` estava desatualizado: dizia que os Grupos 2/3/4 nunca subiram, mas a migração incremental terminou em 01/08. Medido contra o projeto `localstorage-98492` — o ruleset no ar (`295e2b61`) era **byte a byte igual** ao arquivo, exceto por estas 4 linhas. Publicado via `scripts/rules-history.mjs publish`; depois do bloco `promo_state` (CRÍTICO 3) o ruleset no ar é **`6de40658-08d7-4997-a4ca-706608b8e87a`**, sem nenhuma diferença para o arquivo do repo. O rollback foi **exercitado em produção**: ida e volta entre dois rulesets levou 5 segundos e nada se perdeu.
- **Regressão da regra:** `scripts/test-firestore-rules.mjs` roda contra o emulador e ganhou 4 casos — grava `birthdate` uma vez, recusa a troca para hoje, continua deixando editar os outros campos, e o admin ainda corrige uma data errada. Provado: removendo as 4 linhas da regra, "owner cannot move birthdate to today" falha porque a escrita passa.

### BAIXO 1 — Subtotal/descontos exibidos não somam o total cobrado `[AUDITORIA]` — ✅ **CORRIGIDO**

- **Onde:** `api/_lib/fx.js:66-73` (cushion 4% + ¥5) vs `api/_lib/commerce.js:306-314` (descontos convertidos `exact:true`, sem cushion). O `total` soma só as parcelas com cushion.
- **Impacto:** a conta na tela não bate com o cobrado (~R$2 em pedido típico). Reclamação e chargeback.
- **Diagnóstico:** o subtotal saía com cushion e os descontos com a taxa exata, então `subtotal − descontos` não dava o valor de produtos que entrou no total: sobravam ~4% do desconto.
- **A correção que NÃO foi feita, e por quê.** A leitura literal do achado — "aplicar cushion uma única vez sobre o total em ienes" — faz a soma fechar, mas passa a cobrar cushion também sobre as parcelas que hoje vão pela taxa exata. Medido num pedido típico: **R$416,11 → R$419,94, +0,92% em todo pedido**. Subir preço não é corrigir bug; foi descartado.
- **Correção aplicada:** `total`, `totalYen` e `tax` ficam **byte a byte como eram** (conferido rodando o mesmo pedido antes e depois). O que mudou são só as linhas de cima da conta: cupom, pontos e desconto de pagamento passam a usar a **mesma taxa efetiva que produziu `productsDisplay`**, e o subtotal é derivado de volta a partir dele. O subtotal é quem absorve o arredondamento — mexer num desconto faria a tela anunciar abatimento diferente do aplicado, e mexer em produtos quebraria a soma com o total.
- **A conta vai gravada no pedido** (`orders.js`, campo `priceBreakdown`), congelando o que o cliente viu. O câmbio muda todo dia; sem isso, uma contestação meses depois não tem como reconstruir por que o total foi aquele.
- **Regressão:** `commerce.test.js` — "a soma das linhas exibidas fecha com o total" (com cupom, pontos, frete, taxa PS e imposto todos diferentes de zero, senão o teste passaria por vacuidade) e "o caminho do iene fica inteiro e o total exibido é o cobrado".

### BAIXO 2 — Admin fallback hardcoded + cron não constante-time `[AUDITORIA]` — ✅ **CORRIGIDO**

- **Onde:** `api/_lib/auth.js:22-24,57-58`, `api/admin.js`, `api/kimiclaw.js:231`
- **Defeito:** `'dracko2007@gmail.com'` como fallback em 4 arquivos se `ADMIN_EMAIL` não configurado; `requireCronSecret` compara com `!==` (não `timingSafeEqual`).
- **Correção aplicada:** `superAdminEmail()` em `api/_lib/auth.js` é a única fonte, e **lança 503 `admin_not_configured`** em vez de cair num endereço pessoal — deploy sem `ADMIN_EMAIL` entregava o painel para uma caixa que não é da loja. Os 4 usos de API passaram a consumi-la; no front o literal saiu de `src/config/admin.ts` e o `Admin.tsx` deixou de redeclarar a constante.
  - Em `requireAdmin` a ausência da variável apenas **pula** o ramo de bootstrap em vez de derrubar a requisição: quem já está gravado em `admins/{uid}` não depende dessa env var para entrar.
  - Descoberto de quebra: o comentário do `Admin.tsx` dizia que aquela constante controlava o acesso à tela. Não controlava — é só o destinatário do e-mail de teste. Quem barra é o guarda de sessão mais as regras do Firestore. O comentário foi corrigido, porque fazia parecer que apagar a constante abriria o painel.
- **Correção do cron:** `requireCronSecret` usa `timingSafeEqual` com a checagem de comprimento antes (buffers de tamanhos diferentes fazem a função **lançar**, não devolver `false`) — mesmo cuidado do `ps-fee-waiver.js`.
- **Regressão:** `api/_lib/auth.test.js`, 14 testes. Provado: com o fallback de volta, 2 falham; e há caso específico para o segredo de comprimento diferente não estourar `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`.

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
12. ✅ `birthdate` congelado após a primeira gravação + idade mínima de conta (MEDIO 4) — `firestore.rules` / `user-rewards.js`, com 4 regressões de API e 4 de regra. **Publicado em produção.**
13. ✅ Conta exibida que fecha com o total cobrado (BAIXO 1) — `commerce.js`, com 2 regressões. O total cobrado ficou **inalterado**: a variante que "fechava a conta" subindo tudo para o cushion cobraria +0,92% de todo pedido e foi descartada.
14. ✅ Fim do e-mail de admin hardcoded e comparação constante-time no cron (BAIXO 2) — `auth.js` / `admin.js` / `kimiclaw.js` / `config/admin.ts`, com 14 regressões.
15. ✅ Reserva de unidade da promoção, fechando a corrida que sobrava do CRÍTICO 3 — `promo-reserve.js` novo, com 28 regressões.
16. ✅ Ferramenta de regras: `scripts/rules-history.mjs` (`list`/`current`/`diff`/`publish`/`rollback`) e trava `predeploy` contra `firebase deploy` acidental. O `publish-rules.cjs` antigo estava quebrado desde a v14 do `firebase-admin` (`admin.credential.cert` deixou de existir).
17. ✅ CPF obrigatório no destino Brasil e cupom de uso único trancado por CPF (ALTO 3, decisão do dono) — `orders.js` / `fulfillment.js`, com 7 regressões.
18. ✅ Estorno mantido manual (ALTO 1, decisão do dono), com o risco remedido: medido em produção que `insufficient_stock` não dispara em loja dropship, e as duas causas restantes foram fechadas pelas reservas.

### Restante, por prioridade

1. **Dívida técnica, sem prazo forçado:** subir `strict:true` no `tsconfig.app.json` e limpar os erros — vai revelar mais defeitos do tipo "pode ser undefined". Não foi feito nesta leva porque é uma varredura por `src/` inteiro, sem relação com nenhum bug aberto, e misturá-la com correções de pagamento tornaria o diff impossível de revisar.
2. **Quando tocar o arquivo:** remover exports órfãos, não criar novo.
3. **Risco aceito, registrado:** fora do Brasil o cupom público de uso único continua ancorado só em e-mail, porque não existe documento equivalente ao CPF. Decisão consciente do dono em 04/08/2026.
4. **Herança inerte que vale revisitar quando incomodar:** o controle de estoque (`stock.unlimited`/`stock.quantity`) não vale para nenhum produto real — 307 de 308 nem têm o campo. Não é bug, e o código é defensivo, mas é uma engrenagem que roda em todo checkout sem decidir nada. Se a loja nunca for sair do dropship, some junto com o `insufficient_stock`; se for, o caminho já está pronto.

### Lição desta leva

Três dos itens acima chegaram "prontos" com teste verde que **não defendia nada**: a fiação da reserva de pontos, a âncora sem CPF e a corrida da promoção passavam com o fix revertido. O teste unitário do módulo puro dá a sensação de cobertura e não pega a remoção da chamada. Reversão isolada de **cada camada** — não só do conjunto — é o que separa teste de enfeite. Na promoção, as duas camadas mascaravam uma à outra: só reverter as duas juntas falhava, e foi preciso um teste que movesse o estado na janela entre a cotação e a transação para prender a camada atômica sozinha.

---

## Apêndice — exports órfãos completos (47)

`catalogShipping:catalogWeightG` · `japanPostRates:getKozutsumiRate` · `pricing:variantById` · `romanize:{romanizeJapanese,addAddressHintsSync,formatCityAddress}` · `shippingDimensions:{addSafetyMargin,fallbackBoxesFromSmallEquivalent}` · `sku:{categoryCode,skuPrefix,isValidSku,assignSkus}` · `taxRules:{BRAZIL_TAX,ICMS_BY_UF,ufFromCep,calcEuVat}` · `validation:{isValidJapanesePostalCode,maskJapanesePostalCode}` · `types/review:calculateReviewPoints` · `fxService:FX_BUFFER_YEN` · `mailService:sendConfirmationEmail` · `waServerService:{msgPaymentConfirmed,msgPreparing,msgShipped}` · `use-toast:reducer` · `useCookieConsent:setCookieConsent` · `europePrefectures:europeShippingRates` · `prefectures:shippingRates` · `worldCountries:FALLBACK_CONFIG` · `UserContext:makeWelcomeCoupon` · `ui/alert:AlertTitle` · `ui/badge:badgeVariants` · `ui/card:CardFooter` · `ui/dialog:{DialogPortal,DialogOverlay,DialogClose,DialogTrigger}` · `ui/toast:ToastAction` · `api/admin:handleUsers` · `cart-recovery-profile:recordPurchaseDiscount` · `firebase-admin:adminApp` · `firestore-products:{parseValue,parseFields}` · `mailer:BRAND` · `order-analytics:orderDateCursorValue` · `shared/points:{SPEND_WINDOW_MONTHS,isPaidLoyaltyOrder}`

*Nota: exports de componentes `ui/` mortos (seção 2.2) somam outros órfãos que somem junto quando os arquivos forem apagados.*
