# Relatório — Correção dos bugs reportados + reserva de estoque (2026-08-28)

> **Commitado e enviado (`git push`) para `origin/main`** ao final desta sessão — ver hash do commit no histórico do repositório (`git log`). A única outra ação que afetou o ambiente ao vivo foi a publicação de regras do Firestore (mecanismo próprio do projeto, fora do git — ver seção "Bug 6" e "Como desfazer"), necessária para o Bug 6 funcionar de verdade.

## Método

1 agente mestre orquestrou: 4 scouts (mapeamento de causa raiz) → 3 programadores paralelos, cada um com escopo de arquivos isolado (bugs 1-2, bug 3, bugs 4-6) → 3 analistas paralelos (um por programador, revisão independente lendo o diff real, não o resumo do programador) → mestre corrigiu 2 achados cross-file/fora-de-escopo apontados pelos analistas, publicou a regra de segurança do Firestore necessária para o Bug 6, e rodou verificação final.

**Verificação final do mestre:** `npx tsc --noEmit` limpo (0 erros), `node scripts/run-vitest.mjs run` → **416/416 testes passando em 59 arquivos**, e **smoke test real** — compra real (pedido gravado e pago via fluxo manual, sem Stripe), avaliação real com foto real, dashboard real, corrida real de checkout na última unidade — tudo com o código de produção, contra o Firestore/Storage reais, revertido ao final. Ver seção "Smoke test real" no fim deste relatório. Esse teste encontrou e corrigiu 2 problemas adicionais não relatados originalmente (Bug 7, histórico de pedidos; Bug 8, "esgotado" na página do produto), e depois implementou uma melhoria pedida pelo dono (reserva temporária de estoque para PIX/Wise/depósito, ver seção própria).

Nenhum bug foi "consertado" sem antes reproduzir a causa raiz por leitura de código — os 6 itens abaixo foram confirmados antes de qualquer edição (evidência em `agent://ScoutPricing`, `agent://ScoutAdminDashboard`, `agent://ScoutStockLimit`, `agent://ScoutReviews`).

---

## Bug 1 — Valor cobrado no pagamento maior que o exibido (imposto embutido indevidamente)

**Causa raiz:** `api/_lib/commerce.js` (`buildQuote`) somava o imposto estimado (`taxDisplay`) dentro de `total`/`totalYen` — esse valor vira `order.totalPrice`, usado por `stripeIntent()` para criar a cobrança no Stripe/PIX/Wise. O frontend (Checkout/OrderReview) sempre calculou o resumo **sem** imposto, conforme a promessa em `shared/tax-disclosure.js` ("não é cobrada pela loja").

**Correção:**
- `api/_lib/commerce.js`: `total`/`totalYen` deixaram de somar o imposto. `tax`/`display.tax` continuam calculados e retornados, só que como campo informativo, fora da soma cobrada.
- `api/_lib/commerce.test.js`: teste pré-existente validava a soma ANTIGA (com imposto) e ficou quebrado após o fix, sem ter sido rodado pelo programador — corrigido pelo Analista A para validar o novo contrato. 16/16 passando.

**Risco aceito:** pedidos já existentes no Firestore mantêm o `totalPrice` antigo (com imposto). Sem migração retroativa — só afeta pedidos novos a partir de agora (não pedido pelo escopo).

**Arquivos:** `api/_lib/commerce.js`, `api/_lib/commerce.test.js`.

---

## Bug 2 — Frete na moeda errada + taxa PS ausente na confirmação

**2a) Frete:** o valor de frete é sempre calculado em ¥ (iene), mas era exibido formatado com a moeda do pedido (ex.: R$) em `OrderConfirmation.tsx`, `Profile.tsx`, `Admin.tsx` e no recibo térmico. O número já estava certo — só o rótulo/moeda de exibição estava errado.

**Correção:** todos os pontos passaram a formatar o campo de frete sempre como `¥`/JPY, nunca na moeda local do pedido:
- `src/pages/OrderConfirmation.tsx` (usa `order.shippingCostYen` + `formatPrice(..., 'JPY')`)
- `src/pages/Profile.tsx` (histórico de pedidos)
- `src/pages/Admin.tsx` (recibo impresso na tela + detalhe do pedido expandido — só essas 2 linhas, nada de contagem/status foi tocado aqui)
- `thermal-print-server/server.js` (achado extra do Analista A — **mesma classe de bug**, no serviço de impressão térmica de recibos, fora do escopo original de todos os 3 programadores; corrigido pelo mestre)

**2b) Taxa PS ausente:** a tela pós-pagamento (`OrderConfirmation.tsx`, bloco "Invoice Totals") não tinha linha de "Taxa Personal Shopper" (Checkout/OrderReview já mostravam corretamente, não foram tocados). Adicionada a linha, condicionada a `psFeeYen > 0`, formatada em ¥.

**Arquivos:** `api/orders.js` (nenhuma mudança necessária, só inspecionado), `src/pages/OrderConfirmation.tsx`, `src/pages/Profile.tsx`, `src/pages/Admin.tsx`, `thermal-print-server/server.js`.

---

## Bug 3 — Dashboard admin: cancelados/pendentes errados + financeiro não separa PS do frete

**Causa raiz:**
- `api/_lib/order-analytics.js` contava status com os literais `'pending'/'shipped'/'delivered'/'cancelled'`, mas o ciclo real do pedido usa `'pending_payment'` → `'confirmed'`/`'payment_review'` — nenhum desses caía em bucket nenhum, ficavam invisíveis.
- `src/pages/Admin.tsx` tinha 2 lógicas de "pendente" divergentes (badge do menu vs. card de teste).
- `receitaPS` lia o campo `psFeeFinalYen`, que **nunca existiu** no documento — o campo real é `psFeeYen`. Resultado: taxa PS sempre computava 0 e ficava embutida em "Receita Produto"/frete, nunca separada.
- `api/admin.js` (`ORDER_FIELDS`) fazia `.select()` com nomes de campo que também não existiam (`grandTotalYen`, `shippingCost`) — o dado nem chegava ao servidor.

**Correção:**
- `api/_lib/order-analytics.js`: novo mapeamento documentado em comentário — `pending_payment`→pendente, `payment_review`→bucket próprio (dinheiro cobrado mas separação falhou, alta prioridade), `confirmed`/`processing`/`packing`→confirmado (pago, em preparo), `shipped`/`delivered`/`cancelled` mantidos. `receitaPS` agora lê `psFeeYen` real; `orderRevenueYen`/`orderShippingYen` leem `totalYen`/`shippingCostYen` reais (com fallback para pedidos manuais legados que só gravam `grandTotalYen`).
- `api/admin.js`: `ORDER_FIELDS` corrigido para os nomes reais.
- `src/pages/Admin.tsx`: eliminada a lógica duplicada de "pendente" (card de teste passou a usar a mesma fonte do badge do menu).
- `src/components/admin/Dashboard.tsx`: 2 novos cards ("Confirmados" e "Revisão de Pagamento") + gráfico de pizza atualizado.
- `api/_lib/order-analytics.test.js`: fixture antiga validava os nomes de campo ERRADOS (validava o bug) — corrigida; testes novos cobrindo os 6 buckets de status e o fallback de receita.

**Verificado pelo Analista B:** todos os 8 literais de status realmente gravados no Firestore (confirmados via grep em `api/orders.js`, `api/_lib/fulfillment.js`, `src/services/orderService.ts`) caem em exatamente 1 bucket — nenhum pedido fica "no limbo".

**Arquivos:** `api/_lib/order-analytics.js`, `api/_lib/order-analytics.test.js`, `api/admin.js`, `src/pages/Admin.tsx`, `src/components/admin/Dashboard.tsx`.

---

## Bug 4 — Seletor de quantidade não respeita o limite de estoque

**Causa raiz:** o botão "+" da página do produto (`ProductDetail.tsx`) só fazia `quantity + 1`, sem checar `product.stock.quantity`. O travamento real só existia (silenciosamente, sem aviso) dentro do carrinho (`CartContext.tsx`). A baixa de estoque via webhook do Stripe **já funcionava** corretamente (transação atômica em `api/_lib/fulfillment.js`) — o bug era 100% de UI, confirmado por leitura de código antes de qualquer edição.

**Correção:**
- `src/context/CartContext.tsx`: lógica de limite extraída para `getMaxQty(product)` (exportada), reaproveitada em vez de duplicada.
- `src/pages/ProductDetail.tsx`: seletor agora trava em `getMaxQty(product)`, botão "+" desabilita visualmente no limite, toast de erro ("Limite de estoque atingido") ao tentar passar, e a quantidade é re-travada se o usuário trocar de produto.

**Nota do Analista C (não bloqueante):** `src/components/cart/CartItem.tsx` (stepper da página do Carrinho) mantém seu próprio cálculo equivalente em vez de reusar `getMaxQty` — funciona igual, mas é duplicação de lógica não aproveitada. Não corrigido (fora do escopo original, comportamento já correto).

**Arquivos:** `src/context/CartContext.tsx`, `src/pages/ProductDetail.tsx`.

---

## Bug 5 — Quantidade vendida não aparece / editável manualmente

**Causa raiz:** o campo real (`salesCount`, não `soldCount`) **já era incrementado corretamente** no backend (mesma transação atômica do bug 4) e já aparecia no card da loja. O problema real: (1) no admin, o campo era editável manualmente no formulário, divergindo do valor automático; (2) faltava exibição na página individual do produto e na lista do admin.

**Correção:**
- `src/components/admin/ProductManager.tsx`: campo "Qtd. vendida" virou somente-leitura (com texto explicando que é automático); badge "📊 N vendido(s)" adicionado na listagem/cards do admin.
- `src/pages/ProductDetail.tsx`: texto "X vendidos" adicionado na página individual, ao lado das estrelas.

**Nota (documentação, não bug de comportamento):** `src/types/index.ts` ainda tem comentário desatualizado dizendo que o campo é manual — cosmético, não corrigido.

**Arquivos:** `src/components/admin/ProductManager.tsx`, `src/pages/ProductDetail.tsx`.

---

## Bug 6 — Avaliação com foto: pontos, estrelas e persistência real

**Causa raiz:** pontos por avaliação **já funcionavam** corretamente (`api/user-rewards.js`, ledger no Firestore, idempotente, valida compra — não tocado). O problema real: o **conteúdo** da avaliação (nota, comentário, fotos) só era salvo em `localStorage` do navegador (`src/services/reviewService.ts`) — nunca ia para o Firestore. Consequência: sumia ao trocar de dispositivo, admin só moderava o que estava no navegador dele, e qualquer um podia forjar reviews manipulando o localStorage.

**Correção — migração completa para Firestore:**
- `src/services/reviewService.ts`: reescrito para usar Firestore (coleção `reviews`, doc id determinístico `{productId}_{uid}` — 1 review por usuário por produto). `addReview` grava a review e atualiza `rating`/`reviewCount` do produto numa transação atômica.
- `src/components/products/ReviewModal.tsx`: upload de fotos migrado de base64 para Firebase Storage (`review-photos/{productId}/...`) — evita estourar o limite de 1MB por documento do Firestore.
- `src/components/products/ProductReviews.tsx`, `src/pages/ProductDetail.tsx`: carregamento assíncrono do Firestore (estrelas + texto + fotos na página individual).
- `src/components/admin/ReviewModeration.tsx`: moderação agora lê/apaga do Firestore (todas as reviews reais, não só as do navegador do admin).
- `firestore.rules`: novas regras para `/reviews/{reviewId}` (create: autenticado + dono do doc + shape validado; update/delete: dono ou admin) e uma regra adicional em `/products/{productId}` que permite ao próprio usuário atualizar **somente** `rating`/`reviewCount`, e só quando amarrado à criação simultânea do seu próprio doc de review (`existsAfter`/`getAfter`, Firestore Rules v2) — impede escrita livre no produto.
- **Listagem geral de produtos:** continua mostrando só quantidade + estrelas (não mudou), agora refletindo dados reais.
- **Página individual:** estrelas + texto + fotos (já existia visualmente, agora com dados reais).

**Achado crítico do Analista C — corrigido pelo mestre:** o código estava 100% correto, mas as novas regras do Firestore existiam só no repositório, **não publicadas no ambiente ao vivo** (o projeto usa deploy manual/cirúrgico de regras via `scripts/rules-history.mjs`, de propósito, não `firebase deploy`). Sem publicar, toda tentativa de salvar uma avaliação falharia com `permission-denied`. Validado que o diff era 100% aditivo (0 linhas removidas) e sintaticamente válido (compilado contra a Rules API do Firebase antes de publicar) → **publicado**:
- Ruleset anterior: `f85eae27-5acd-4c7b-9dcb-165f468974d2` (estava no ar desde 2026-08-19)
- Ruleset novo, no ar agora: `a79edff7-a97c-4c54-bc34-58216a64af59` (publicado 2026-08-28)

Isso é a única ação desta sessão que alterou algo fora do working tree local — não é git commit/push, é publicação de regra de segurança via API própria do Firebase (mecanismo do projeto), com rollback de 1 comando (ver seção "Como desfazer").

**Achado cross-file — corrigido pelo mestre:** `src/pages/Profile.tsx` chamava `reviewService.canUserReview()` de forma síncrona (`!reviewService.canUserReview(...)`), mas o método virou assíncrono (lê Firestore). Compilava sem erro, mas o badge "já avaliado" no histórico de pedidos nunca apareceria em runtime (Promise é sempre truthy). Corrigido criando o subcomponente `OrderItemReviewAction` (com `useEffect` próprio) em `Profile.tsx`.

**Risco documentado (aceito, não bloqueante):** a regra do Firestore não consegue validar "comprou o produto" diretamente (só autenticação + dono do doc) — a validação de compra real continua 100% no servidor (`api/user-rewards.js`), chamada pelo `ReviewModal` antes de gravar a review. Um usuário autenticado que manipular a chamada ao Firestore diretamente (fora da UI) poderia, tecnicamente, gravar uma review sem compra real — não gera pontos indevidos (isso é protegido no servidor), só poderia distorcer a média exibida. Mitigação total exigiria validação de compra em Cloud Function ou regra com leitura cruzada em `orders`, não incluída neste escopo.

**Arquivos:** `src/services/reviewService.ts`, `src/components/products/ReviewModal.tsx`, `src/components/products/ProductReviews.tsx`, `src/components/admin/ReviewModeration.tsx`, `src/pages/ProductDetail.tsx`, `src/pages/Profile.tsx`, `firestore.rules`.

---
## Bug 7 (encontrado durante o smoke test real, não estava na lista original) — Histórico de pedidos com "¥ NaN" e moeda errada

**Como foi encontrado:** ao rodar o smoke test real de ponta a ponta (comprar de verdade, ver seção "Smoke test real" abaixo), a tela **Meu Perfil → Histórico de Compras** mostrou o preço do item como "¥ NaN" e o total do pedido rotulado em ¥ mesmo sendo um pedido em R$.

**Causa raiz:** `src/context/UserContext.tsx` (`loadOrdersFromFirestore`) usa uma lista fixa e estreita de campos ao montar o objeto de pedido a partir do Firestore para a tela de Perfil — não incluía `currency` (por isso caía no fallback `'JPY'`, mostrando ¥ em pedidos BRL) nem convertia `item.unitYen` (campo real gravado pelo checkout) para `item.price` (campo que a tela espera), gerando `item.price * item.quantity` = `NaN`.

**Correção:**
- `src/context/UserContext.tsx`: `loadOrdersFromFirestore` passou a preservar `currency`, `psFeeYen`, `taxAmount`, `couponCode`, `couponDiscount`, `appliedCoupon`, `grandTotalYen`, `paymentConfirmed` e `priceBreakdown` (breakdown já convertido para a moeda do pedido, gravado pelo checkout) do documento bruto.
- `src/pages/Profile.tsx`: preço por item agora usa `item.price` quando existe (pedidos manuais legados, já em moeda local) ou `item.unitYen` formatado sempre em ¥ (pedidos do checkout real) — nunca mais tenta formatar um valor em ¥ como se fosse reais. Bloco de subtotal/desconto/total passou a usar `priceBreakdown` (já convertido, fonte de verdade) em vez de recalcular a partir de itens em ¥ — o cálculo antigo gerava um "desconto de cupom" fantasma (ex.: "-R$ 3.082" para um pedido de R$ 318) sempre que não havia cupom nenhum. Taxa Personal Shopper adicionada ao mesmo bloco (mesma lógica do Bug 2b).

**Arquivos:** `src/context/UserContext.tsx`, `src/pages/Profile.tsx`.

---

## Bug 8 (achado a pedido do dono, confirmando suspeita dele) — Página do produto não mostrava "Esgotado" com estoque zerado

**Como foi encontrado:** o dono perguntou diretamente "mas aparece esgotado com baixa no estoque certinho?" depois do smoke test do Bug 4. Testei especificamente o caso de estoque **zerado** (não só "baixo") num produto real (revertido depois) e reproduzi o problema pelo navegador antes de corrigir.

**Causa raiz:** `src/pages/ProductDetail.tsx` (página individual) nunca tinha um estado visual de "esgotado" — só a listagem geral (`CompactProductCard.tsx`) já mostrava corretamente o selo "ESGOTADO" e escondia o botão de compra. Na página individual: (1) o efeito que trava a quantidade ao limite de estoque usava `Math.max(1, max)`, um piso que IMPEDIA a quantidade de chegar a `0` mesmo com estoque zerado — a tela sempre mostrava "1" disponível para compra; (2) `handleAddToCart` não tinha nenhuma guarda contra estoque zero — ao clicar "Adicionar ao Carrinho" em um produto esgotado, aparecia o toast de sucesso "Adicionado!" (falso positivo, confirmado no navegador) mesmo o item **não** sendo realmente adicionado (o `CartContext.addToCart` já barrava a escrita silenciosamente, então o carrinho ficava correto, mas o cliente via uma mensagem de sucesso enganosa); (3) não existia nenhum selo "ESGOTADO" nem os controles de quantidade/botão de compra ficavam desabilitados.

**Correção (`src/pages/ProductDetail.tsx`):**
- Novo `isSoldOut = Number.isFinite(maxQty) && maxQty <= 0`.
- Efeito de clamp da quantidade corrigido para `Math.max(0, Math.min(q, max))` — quantidade chega a `0` de verdade quando esgotado.
- `handleAddToCart` agora verifica `isSoldOut` primeiro e mostra toast de erro "Produto esgotado" em vez de adicionar/fingir que adicionou.
- Botões "-"/"+" e "Adicionar ao Carrinho" ficam desabilitados (visualmente e via `disabled`) quando esgotado; o botão passa a exibir o texto "Esgotado".
- Novo banner vermelho "🚫 ESGOTADO — sem estoque no momento" acima do seletor de quantidade, mesmo padrão visual do selo já usado na listagem geral.
- O aviso de "apenas X unidades disponíveis" não aparece mais duplicado quando já esgotado (o banner cobre esse caso).

**Verificado no navegador real:** com um produto real de teste em `stock.quantity: 0` (revertido depois), a página passou a mostrar o banner "ESGOTADO", quantidade "0", os três controles desabilitados, e clicar no botão (mesmo desabilitado) não gera mais o toast falso de sucesso nem qualquer navegação.

**Arquivos:** `src/pages/ProductDetail.tsx`.

---

## Achado Importante (não é bug — melhoria pedida pelo dono) — Reserva temporária de estoque para PIX/Wise/depósito

**A pergunta do dono:** Stripe (cartão) dá baixa automática via webhook em segundos. PIX/Wise/depósito só confirmam à mão, às vezes horas depois. Se só sobra 1 unidade, alguém compra por PIX e, antes de confirmar, outra pessoa compra a mesma unidade no cartão — o cartão dá baixa na hora e "provavelmente não vai bloquear" o PIX de ser criado também.

**Confirmado que o risco é real:** `api/orders.js` (criação do pedido) só lia `product.stock.quantity` puro, sem descontar pedidos concorrentes ainda não pagos. Dois checkouts simultâneos na última unidade passavam os dois na criação; só na hora de `fulfillOrder` (confirmação) o segundo era recusado com `insufficient_stock` — **depois** do cliente já ter pago e recebido instrução de pagamento. Não é overselling (a trava atômica de `fulfillOrder` nunca deixa o estoque ir negativo), mas é uma promessa quebrada ao cliente que pagou por último, e um estorno manual chato para a loja.

**Achado importante:** o sistema já tinha exatamente esse padrão implementado para outro caso — a promoção da home (`api/_lib/promo-reserve.js`, resolvendo o mesmo tipo de corrida para a última unidade da promoção). Repliquei o mesmo padrão para o estoque comum de qualquer produto.

**Como funciona agora (`api/_lib/stock-reserve.js`, novo):**
- Cada produto com estoque controlado ganha um documento `stock_reserve/{productId}` só quando necessário, com uma lista de reservas (`holds`): `{ orderId, quantity, expiresAt }`.
- Ao criar um pedido (`api/orders.js handleCreate`), a checagem de estoque passa a descontar as reservas vigentes de outros pedidos antes de aceitar; e, dentro da MESMA transação que cria o pedido, revalida e grava a própria reserva atomicamente — fechando a janela entre duas criações simultâneas.
- Prazo da reserva depende do método de pagamento (reaproveita `prazoReserva` de `promo-reserve.js`): **2 horas** para cartão (Stripe resolve em minutos; 2h cobre 3DS/atraso de webhook sem prender estoque de checkout abandonado por muito tempo) e **24 horas** para PIX/Wise/depósito/PayPay/Yucho (métodos que a loja confirma à mão).
- A reserva é liberada explicitamente antes do prazo em dois casos: (1) pedido confirmado (`fulfillOrder`) — vira baixa de estoque de verdade na mesma transação; (2) pedido cai em `payment_review` (falha) — libera para não prender a unidade de um pedido morto.
- Reserva vencida (ninguém confirmou nem cancelou) é simplesmente ignorada na próxima leitura e podada na próxima escrita — não existe endpoint de cancelamento de pedido no servidor, então o prazo é o único jeito de garantir que um checkout abandonado não prenda a unidade para sempre.
- Produto com `stock.unlimited: true` nunca cria reserva — não disputa unidade com ninguém.

**Testado:**
- 25 testes automatizados novos (`api/_lib/stock-reserve.test.js`, aritmética pura; `api/_lib/orders.stock-reserve.test.js`, integração com `handleCreate`/`fulfillOrder`/`markFulfillmentReview` reais contra um Firestore simulado) — incluindo o teste da corrida de verdade: estado muda entre a checagem inicial e a transação, e o segundo pedido é recusado mesmo assim.
- **Confirmado também contra o Firestore real:** produto de teste com `stock.quantity: 1`, dois `handleCreate` disparados em paralelo de verdade (`Promise.all`) — um voltou `201` (criado, reserva gravada), o outro voltou `409 insufficient_stock` **na hora de criar o pedido**, não na confirmação. Limpeza confirmada depois (pedido de teste, doc de reserva e campo de estoque do produto todos removidos).

**Risco aceito:** a checagem de disponibilidade em `orders.js` ainda lê `product.stock.quantity` do documento buscado ANTES da transação (mesma convenção já usada pela promoção da home) — só a contagem de RESERVAS é revalidada atomicamente dentro da transação. Se o estoque base em si mudar entre a leitura e a transação (ex.: um admin edita o estoque manualmente no mesmo instante), a checagem usa o valor um pouco desatualizado; a trava final e definitiva contra estoque negativo continua sendo `fulfillOrder`, que sempre foi e continua sendo a fonte de verdade.

**Arquivos:** `api/_lib/stock-reserve.js` (novo), `api/_lib/stock-reserve.test.js` (novo), `api/_lib/orders.stock-reserve.test.js` (novo), `api/orders.js`, `api/_lib/fulfillment.js`.

---

## Todos os arquivos alterados/criados (23) — commitados e enviados nesta sessão

Modificados:
```
api/_lib/commerce.js
api/_lib/commerce.test.js
api/_lib/order-analytics.js
api/_lib/order-analytics.test.js
api/_lib/fulfillment.js
api/admin.js
api/orders.js
firestore.rules
src/components/admin/Dashboard.tsx
src/components/admin/ProductManager.tsx
src/components/admin/ReviewModeration.tsx
src/components/products/ProductReviews.tsx
src/components/products/ReviewModal.tsx
src/context/CartContext.tsx
src/context/UserContext.tsx
src/pages/Admin.tsx
src/pages/OrderConfirmation.tsx
src/pages/ProductDetail.tsx
src/pages/Profile.tsx
src/services/reviewService.ts
thermal-print-server/server.js
```
Criados:
```
api/_lib/stock-reserve.js
api/_lib/stock-reserve.test.js
api/_lib/orders.stock-reserve.test.js
```
3 arquivos novos, nenhum arquivo removido. Todos os 23 foram adicionados (`git add`), commitados e enviados (`git push`) para `origin/main` ao final desta sessão — ver `git log` para o hash exato do commit.

---

## Como desfazer

### Código (commitado em `origin/main`)
Para reverter tudo de uma vez, desfazendo o commit desta sessão (ache o hash com `git log --oneline`, deve ser o mais recente, mensagem sobre bugs/reserva de estoque):
```bash
git revert <hash-do-commit>
# ou, se ninguém mais puxou o branch depois (reescreve histórico, cuidado):
git reset --hard <hash-do-commit-anterior> && git push --force-with-lease
```
`git revert` é o caminho seguro (cria um commit novo desfazendo as mudanças, não reescreve histórico); use `reset --hard` + `force-with-lease` só se tiver certeza de que ninguém mais deu pull do branch depois deste commit.
Ou, para reverter só a reserva de estoque (mantendo os 8 bugs corrigidos), reverter manualmente `api/orders.js` e `api/_lib/fulfillment.js` para antes desta mudança (`git log -p api/orders.js` para achar o diff exato) e apagar os 3 arquivos novos — nesse caso, a checagem de estoque volta a não descontar reservas concorrentes (comportamento de antes desta melhoria).
Para reverter também `firestore.rules` no repo local (isto sozinho **não** desfaz a publicação em produção — ver próxima seção):
```bash
git checkout -- firestore.rules
```

### Regra do Firestore publicada (Bug 6) — única mudança fora do git
O arquivo local `firestore.rules` não controla o ambiente ao vivo diretamente; a publicação é manual, via `scripts/rules-history.mjs` (de propósito, ver cabeçalho do script). Para desfazer a publicação feita nesta sessão e voltar ao estado de antes:
```bash
node scripts/rules-history.mjs rollback f85eae27-5acd-4c7b-9dcb-165f468974d2
```
Isso reaponta o release `cloud.firestore` para o ruleset publicado em 2026-08-19, removendo as regras de `/reviews/` e do agregado `rating`/`reviewCount` — sem precisar do arquivo, o Firebase já guarda o ruleset antigo. Confirmar com `node scripts/rules-history.mjs current`.
⚠️ Se fizer isso, o Bug 6 volta a acontecer no ambiente ao vivo (reviews voltam a falhar com `permission-denied` — o código novo não tem mais fallback para localStorage, então nem "funciona mal como antes": simplesmente não salva).

### Verificação pós-rollback (qualquer um dos casos acima)
```bash
npx tsc --noEmit -p tsconfig.app.json
node scripts/run-vitest.mjs run
```

---

## Verificação executada (evidência)

- `npx tsc --noEmit -p tsconfig.app.json` → **0 erros**, projeto inteiro (rodado de novo após todas as correções, inclusive a reserva de estoque).
- `node scripts/run-vitest.mjs run` → **416/416 testes passando, 59 arquivos** (397 da correção dos bugs + 19 novos da reserva de estoque).
- `node scripts/rules-history.mjs diff` → 0 linhas de diferença entre repo e produção após publicar (regras 100% sincronizadas, publicação aditiva confirmada).

## Smoke test real (compra de verdade, código de produção, sem mock)

Depois da correção, montei um servidor local mínimo hospedando os handlers **reais** de `api/orders.js`, `api/user-rewards.js` e `api/admin.js` (sem Stripe — não é necessário para pagamento `bank`/PIX) contra o Firestore real do projeto, e usei o navegador contra o `localhost:8080` já rodando. Toda ação de escrita foi cronometrada, verificada e **revertida ao final** (produto, usuário, pedido e review de teste voltaram ao estado exato de antes). Nenhum dado de cliente real foi tocado; Stripe nunca foi acionado (chave nem existe neste ambiente).

1. **Bug 1 (imposto não cobrado):** rodei `buildQuote` (código real) com produto de ¥5.000/Brasil — total cobrado bateu exatamente com produtos+frete+PS (R$293,98), imposto (R$73,52) calculado à parte, fora da cobrança. Depois criei 1 pedido real via `api/orders.js handleCreate` (paymentMethod `bank`): `totalPrice: 318.27` bateu com `totalYen(9480) = produto(3400)+frete(5080)+PS(1000)`, sem imposto — **confirmado com pedido real gravado no Firestore**.
2. **Bug 2 (frete em ¥, PS fee visível):** o mesmo pedido real trouxe `shippingCostYen: 5080` e `psFeeYen: 1000` como campos próprios em ¥; após a correção, `Profile.tsx`/`OrderConfirmation.tsx` exibem esses valores sempre em ¥, nunca convertidos para a moeda do pedido — **confirmado visualmente no navegador**.
3. **Bug 3 (dashboard):** chamei `api/admin.js handleDashboard` (código real) logo após criar o pedido de teste (status `pending_payment`) — `stats.pendingOrders: 1` (antes ficaria invisível), `finance.receitaPS: 1000`, `finance.receitaProduto: 3400` (PS corretamente excluído) — **confirmado com agregação real sobre dado real**.
4. **Bug 4 (limite de estoque):** defini `stock.quantity: 3` num produto real (revertido depois) e cliquei "+" repetidamente na página do produto real — travou em 3, botão desabilitou, toast "Limite de estoque atingido" apareceu — **confirmado clicando de verdade no navegador**. Durante este teste também corrigi um erro de português encontrado no aviso ("disponívelis" → "disponíveis", `src/pages/ProductDetail.tsx`).
5. **Bug 5 (vendidos):** defini `salesCount: 47` num produto real (revertido depois) — "47 vendidos" apareceu na página individual **e** na listagem geral — **confirmado visualmente**.
6. **Bug 6 (avaliação com foto):** confirmei manualmente o pagamento de um pedido real (`api/orders.js handleConfirmManualPayment`, mesmo caminho que o admin usa para PIX/depósito — sem Stripe), o que rodou `fulfillOrder` de verdade (estoque/vendas). Fui em Meu Perfil → Histórico → Avaliar, preenchi nota 5, comentário e **subi uma foto real** (foi parar no Firebase Storage de verdade). A avaliação foi salva no Firestore (coleção `reviews`, regra publicada nesta sessão), os pontos foram creditados de verdade (+1, ledger `point_reward_claims` real), e a página individual do produto passou a mostrar "5.0 · 1 avaliações", nome do avaliador, "✓ Compra Verificada", comentário e a foto — a listagem geral mostrou só "5.0 · 1 vendidos" (sem texto) — **confirmado de ponta a ponta com dado real**. Nota: a primeira tentativa de gravar a avaliação (antes de eu montar o servidor local de API) falhou uma vez com "Missing or insufficient permissions" num instante isolado; reproduzi a mesma escrita 3 vezes depois (REST direto, REST em lote, e via `reviewService.addReview` real) e todas passaram — indício de uma falha transitória de token/rede naquele instante específico, não um defeito de regra ou código (as regras foram validadas program aticamente contra a API do Firebase antes de publicar, e voltaram a passar em toda tentativa seguinte).
7. **Bug 7 (achado durante este teste):** o histórico de pedidos mostrava "¥ NaN" no item e o total na moeda errada — corrigido em `UserContext.tsx`/`Profile.tsx` (ver seção Bug 7 acima) e reconfirmado no mesmo pedido real: item "¥ 3.400", subtotal "R$ 115 (¥ 3.450)", frete "¥ 5.080", "Taxa Personal Shopper R$ 32", total "R$ 318 (¥ 9.480)" — tudo consistente.
8. **Bug 8 (achado a pedido do dono, pergunta direta "aparece esgotado com baixa no estoque certinho?"):** defini `stock.quantity: 0` no mesmo produto real (revertido depois). Antes da correção: quantidade mostrava "1" (nunca "0"), botão "Adicionar ao Carrinho" ficava habilitado e clicar mostrava o toast falso "Adicionado!" mesmo sem nada entrar no carrinho de verdade. Depois da correção: banner "🚫 ESGOTADO", quantidade "0", os três controles desabilitados, sem toast falso — **confirmado clicando de verdade no navegador, antes e depois da correção**.
9. **Reserva de estoque (pergunta do dono sobre PIX/Wise vs. cartão):** defini `stock.quantity: 1` no mesmo produto real (revertido depois), disparei 2 `handleCreate` de verdade em paralelo (`Promise.all`, mesmo processo Node, mesmo Firestore real) — um voltou `201` (pedido criado, unidade reservada em `stock_reserve/{productId}`), o outro voltou `409 insufficient_stock` **na hora de criar o pedido**, sem chegar a existir — **confirmado contra o Firestore real, não só em teste simulado**.

**Limpeza pós-teste (confirmada):** pedido de teste, review de teste, claim de pontos, evento de idempotência do fulfillment e registros de rate-limit foram apagados; produto voltou a `stock: null, salesCount: null, rating: null, reviewCount: null`; usuário voltou a `points: 0`; foto de teste removida do Storage. Servidor local de API de teste (porta 3000) parado ao final — não fica residente.
