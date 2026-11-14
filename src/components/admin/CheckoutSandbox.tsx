import React, { useMemo, useState } from 'react';
import { Coins, CreditCard, FlaskConical, HandCoins, PiggyBank, Receipt, RotateCcw, ShieldCheck, ShoppingBag, Tag, Truck, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SandboxItem = { name: string; price: number; cost: number; quantity: number; discounted: boolean };

const initialItems: SandboxItem[] = [
  { name: 'Produto em promoção', price: 2000, cost: 1000, quantity: 1, discounted: true },
  { name: 'Produto sem promoção', price: 3000, cost: 1500, quantity: 1, discounted: false },
];

type Purchase = {
  n: number; method: string; source: 'link' | 'code'; tier: string; percent: number;
  gross: number; discount: number; net: number; cost: number; profit: number; commission: number; finalProfit: number;
  extras: number; realProfit: number;
};

const yen = (value: number) => `¥${Math.round(value).toLocaleString()}`;
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1).replace('.0', '')}%` : '—');

const TONES = {
  neutral: 'border-border bg-card',
  green: 'border-green-200 bg-green-50 dark:bg-green-950/20',
  pink: 'border-primary/30 bg-primary/5',
} as const;

const Kpi: React.FC<{ icon: React.ElementType; label: string; value: string; hint?: string; tone?: keyof typeof TONES }> = ({ icon: Icon, label, value, hint, tone = 'neutral' }) => (
  <div className={`rounded-2xl border p-4 ${TONES[tone]}`}>
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-4 w-4" aria-hidden /> {label}</div>
    <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
    {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

const Row: React.FC<{ label: React.ReactNode; value: string; strong?: boolean; tone?: 'minus' | 'plus' }> = ({ label, value, strong, tone }) => (
  <div className={`flex items-center justify-between gap-3 py-1.5 text-sm ${strong ? 'border-t font-bold' : ''}`}>
    <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
    <span className={`tabular-nums ${tone === 'minus' ? 'text-red-600' : tone === 'plus' ? 'text-green-700' : ''}`}>{value}</span>
  </div>
);

type PromoterStats = { link: number; code: number; buyers: number; revenue: number };
const PEOPLE = ['Cliente A', 'Cliente B', 'Cliente C'];
const slugOf = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const CheckoutSandbox: React.FC = () => {
  const [items, setItems] = useState(initialItems);
  const [affiliateCode, setAffiliateCode] = useState('JUNIOR10');
  const [discountPercent, setDiscountPercent] = useState(10);
  const [commissionPercent, setCommissionPercent] = useState(10);
  const [bronzeGoal, setBronzeGoal] = useState(100000);
  const [silverGoal, setSilverGoal] = useState(200000);
  const [affiliateSource, setAffiliateSource] = useState<'link' | 'code'>('link');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [history, setHistory] = useState<Purchase[]>([]);
  // Despesas da venda (opcionais, começam em zero): não mudam a comissão, só o resultado real.
  const [shippingCharged, setShippingCharged] = useState(0);
  const [shippingPaid, setShippingPaid] = useState(0);
  const [psFeeOn, setPsFeeOn] = useState(false);
  const [feePercent, setFeePercent] = useState(0);
  const [result, setResult] = useState('');
  // Divulgador: recebe o produto, sem comissão; mede quem veio (link/código) e quem comprou.
  const [kind, setKind] = useState<'affiliate' | 'promoter'>('affiliate');
  const [person, setPerson] = useState(PEOPLE[0]);
  const [promoProduct, setPromoProduct] = useState(0);
  const [seenVisits, setSeenVisits] = useState<string[]>([]);
  const [usedCodes, setUsedCodes] = useState<string[]>([]);
  const [stats, setStats] = useState<Record<string, PromoterStats>>({});
  const promoter = kind === 'promoter';
  const code = affiliateCode.trim().toUpperCase();
  const promoLink = `https://japanexpress-store.com/produto/${slugOf(items[promoProduct]?.name || 'produto')}?ref=${code || 'CODIGO'}`;
  const current = stats[code] || { link: 0, code: 0, buyers: 0, revenue: 0 };
  const bump = (patch: (value: PromoterStats) => PromoterStats) =>
    setStats((all) => ({ ...all, [code]: patch(all[code] || { link: 0, code: 0, buyers: 0, revenue: 0 }) }));

  const changeKind = (next: 'affiliate' | 'promoter') => {
    setKind(next);
    setAffiliateCode(next === 'promoter' ? 'DIVULGADOR1FINO' : 'JUNIOR10');
    setDiscountPercent(next === 'promoter' ? 0 : 10);
    setResult('');
  };

  // Mesma regra do servidor: cada pessoa conta uma vez por código, pelo link ou pelo código digitado.
  const simulateVisit = (source: 'link' | 'code') => {
    if (!code) { setResult('Informe o código do divulgador.'); return; }
    const key = `${code}|${person}`;
    if (seenVisits.includes(key)) {
      setResult(`NÃO CONTA — ${person} já foi contado neste código (${code}). Cada pessoa conta uma vez por código.`);
      return;
    }
    setSeenVisits((list) => [...list, key]);
    bump((value) => ({ ...value, [source]: value[source] + 1 }));
    setResult(`VISITA CONTADA — ${person} chegou ${source === 'link' ? 'pelo LINK' : 'digitando o CÓDIGO'} ${code}.`);
  };

  // Mesma regra do servidor: um uso por cadastro e por código; sem comissão.
  const simulatePromoterPurchase = () => {
    if (!code) { setResult('Informe o código do divulgador.'); return; }
    const key = `${code}|${person}`;
    if (usedCodes.includes(key)) {
      setResult(`BLOQUEADO — ${person} já usou o código ${code}. Cada cadastro usa cada código uma única vez; um código novo (outro vídeo/produto) libera de novo.`);
      return;
    }
    setUsedCodes((list) => [...list, key]);
    bump((value) => ({ ...value, buyers: value.buyers + 1, revenue: value.revenue + totals.netProducts }));
    setResult(`COMPRA SIMULADA — ${paymentMethod.toUpperCase()} — ${person} com o código ${code} — total ¥${totals.total.toLocaleString()} — SEM comissão: a compra entra só na contagem de retorno do divulgador.`);
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const eligibleForDiscount = items.reduce((sum, item) => !item.discounted ? sum + item.price * item.quantity : sum, 0);
    const discount = Math.round(eligibleForDiscount * (Math.max(0, Math.min(100, discountPercent)) / 100));
    const netProducts = subtotal - discount;
    const productCost = items.reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const profit = Math.max(0, netProducts - productCost);
    return { subtotal, eligibleForDiscount, discount, netProducts, productCost, profit, total: netProducts };
  }, [discountPercent, items]);

  const tierForRevenue = (revenue: number) => revenue > silverGoal ? 'Ouro' : revenue > bronzeGoal ? 'Prata' : 'Bronze';
  const percentForTier = (tier: string) => tier === 'Ouro' ? commissionPercent + 10 : tier === 'Prata' ? commissionPercent + 5 : commissionPercent;

  const month = useMemo(() => {
    const sum = (pick: (purchase: Purchase) => number) => history.reduce((total, purchase) => total + pick(purchase), 0);
    return {
      gross: sum((x) => x.gross), discount: sum((x) => x.discount), net: sum((x) => x.net), cost: sum((x) => x.cost),
      profit: sum((x) => x.profit), commission: sum((x) => x.commission), finalProfit: sum((x) => x.finalProfit),
      extras: sum((x) => x.extras), realProfit: sum((x) => x.realProfit),
    };
  }, [history]);

  // Prévia da próxima compra e distância até o próximo nível (a meta é em LUCRO acumulado no mês).
  const currentTier = tierForRevenue(monthRevenue);
  const nextCommission = Math.round(totals.profit * percentForTier(currentTier) / 100);
  // Despesas: taxa PS (¥1.000 por unidade) entra como receita; a taxa do meio de pagamento
  // incide sobre tudo que o cliente paga (produtos + frete + taxa PS).
  const psFeeCharged = psFeeOn ? items.reduce((sum, item) => sum + item.quantity, 0) * 1000 : 0;
  const customerPays = totals.netProducts + shippingCharged + psFeeCharged;
  const paymentFee = Math.round(customerPays * Math.max(0, feePercent) / 100);
  const extras = shippingCharged - shippingPaid + psFeeCharged - paymentFee;
  const nextGoal = currentTier === 'Bronze' ? bronzeGoal : currentTier === 'Prata' ? silverGoal : 0;
  const nextTierName = currentTier === 'Bronze' ? 'Prata' : 'Ouro';
  const missingProfit = Math.max(0, nextGoal + 1 - monthRevenue);
  const missingSales = missingProfit * (totals.profit > 0 && totals.netProducts > 0 ? totals.netProducts / totals.profit : 2);

  const simulatePayment = () => {
    const tierBefore = tierForRevenue(monthRevenue);
    const saleCommissionPercent = percentForTier(tierBefore);
    const commission = Math.round(totals.profit * saleCommissionPercent / 100);
    const nextRevenue = monthRevenue + totals.profit;
    const nextTier = tierForRevenue(nextRevenue);
    setPurchaseCount((value) => value + 1);
    setMonthRevenue(nextRevenue);
    setHistory((list) => [...list, {
      n: purchaseCount + 1, method: paymentMethod, source: affiliateSource, tier: tierBefore, percent: saleCommissionPercent,
      gross: totals.subtotal, discount: totals.discount, net: totals.netProducts, cost: totals.productCost,
      profit: totals.profit, commission, finalProfit: totals.profit - commission,
      extras, realProfit: totals.profit - commission + extras,
    }]);
    setResult(`COMPRA ${purchaseCount + 1} SIMULADA — ${paymentMethod.toUpperCase()} — ${affiliateSource === 'link' ? 'LINK' : 'CÓDIGO'} ${affiliateCode || '—'} — nível da compra: ${tierBefore} (${saleCommissionPercent}%) — comissão: ${yen(commission)} — próximo nível: ${nextTier}`);
  };

  const reset = () => {
    setItems(initialItems);
    setAffiliateCode('JUNIOR10');
    setDiscountPercent(10);
    setCommissionPercent(10);
    setBronzeGoal(100000);
    setSilverGoal(200000);
    setAffiliateSource('link');
    setPaymentMethod('card');
    setPurchaseCount(0);
    setMonthRevenue(0);
    setHistory([]);
    setShippingCharged(0);
    setShippingPaid(0);
    setPsFeeOn(false);
    setFeePercent(0);
    setResult('');
    setKind('affiliate');
    setPerson(PEOPLE[0]);
    setPromoProduct(0);
    setSeenVisits([]);
    setUsedCodes([]);
    setStats({});
  };

  const resetMonth = () => {
    setPurchaseCount(0);
    setMonthRevenue(0);
    setHistory([]);
    setResult('NOVO MÊS SIMULADO — vendas e comissão mensal zeradas; o nível inicial volta para Bronze.');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-bold text-lg">Sandbox de cupons, links e pagamentos</h2>
            <p className="text-sm text-amber-800 dark:text-amber-200">Ambiente totalmente simulado. Não cria pedido, não grava cupom, não chama Stripe, Pix, banco, Wise ou qualquer meio de pagamento real.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
            <Label>Tipo de parceria</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={!promoter ? 'default' : 'outline'} onClick={() => changeKind('affiliate')}>Afiliado</Button>
              <Button type="button" variant={promoter ? 'default' : 'outline'} onClick={() => changeKind('promoter')}>Divulgador</Button>
            </div>
            <p className="text-xs text-muted-foreground">{promoter ? 'Recebe o produto grátis e divulga. Sem comissão nem meta: o retorno é medido por visitas e compras de cada código.' : 'Comissão por venda, com metas e níveis.'}</p>
          </div>
          {promoter && (
            <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div><h3 className="font-semibold">Divulgador de teste</h3><p className="text-xs text-muted-foreground">Um código e um link por produto/vídeo.</p></div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">{code || 'SEM CÓDIGO'}</span>
              </div>
              <div className="space-y-1"><Label>Código do vídeo</Label><Input value={affiliateCode} onChange={(e) => setAffiliateCode(e.target.value.toUpperCase())} placeholder="DIVULGADOR1FINO" /><p className="text-[11px] text-muted-foreground">Troque o código para simular um novo vídeo: os números e o bloqueio de uso recomeçam para ele.</p></div>
              <div className="space-y-1"><Label>Produto enviado</Label><select value={promoProduct} onChange={(e) => setPromoProduct(Number(e.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{items.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></div>
              <div className="rounded-lg bg-secondary/40 p-2"><p className="text-[11px] text-muted-foreground">Link deste código</p><code className="block break-all text-xs">{promoLink}</code></div>
              <div className="space-y-1"><Label>Quem está testando (cadastro)</Label><div className="grid grid-cols-3 gap-2">{PEOPLE.map((name) => <Button key={name} type="button" size="sm" variant={person === name ? 'default' : 'outline'} onClick={() => setPerson(name)}>{name}</Button>)}</div></div>
              <div className="space-y-1"><Label>Desconto ao comprador (%)</Label><Input type="number" min="0" max="100" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} /></div>
              <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={() => simulateVisit('link')}>{person} abre o link</Button><Button type="button" variant="outline" onClick={() => simulateVisit('code')}>{person} digita o código</Button></div>
            </div>
          )}
          {!promoter && (<>
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div><h3 className="font-semibold">Afiliado de teste</h3><p className="text-xs text-muted-foreground">Configure a origem e as regras da venda.</p></div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{affiliateCode || 'SEM CÓDIGO'}</span>
            </div>
            <div className="space-y-1"><Label>Código de teste</Label><Input value={affiliateCode} onChange={(e) => setAffiliateCode(e.target.value.toUpperCase())} placeholder="JUNIOR10" /></div>
            <div className="space-y-1"><Label>Origem da indicação</Label><div className="grid grid-cols-2 gap-2"><Button type="button" variant={affiliateSource === 'link' ? 'default' : 'outline'} onClick={() => setAffiliateSource('link')}>Link ?ref=</Button><Button type="button" variant={affiliateSource === 'code' ? 'default' : 'outline'} onClick={() => setAffiliateSource('code')}>Código</Button></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Desconto (%)</Label><Input type="number" min="0" max="100" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} /></div><div className="space-y-1"><Label>Comissão base (%)</Label><Input type="number" min="0" max="100" value={commissionPercent} onChange={(e) => setCommissionPercent(Number(e.target.value))} /></div></div>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
            <div><h3 className="font-semibold">Metas do mês (em LUCRO)</h3><p className="text-xs text-muted-foreground">O nível sobe pelo lucro acumulado no mês, não pelo valor vendido. A próxima compra usa o novo nível.</p></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Meta Prata (lucro, ¥)</Label><Input type="number" min="0" value={bronzeGoal} onChange={(e) => setBronzeGoal(Number(e.target.value))} /></div><div className="space-y-1"><Label>Meta Ouro (lucro, ¥)</Label><Input type="number" min="0" value={silverGoal} onChange={(e) => setSilverGoal(Number(e.target.value))} /></div></div>
            <div className="rounded-xl bg-secondary/50 p-3 text-sm"><div className="flex justify-between"><span>Nível atual</span><strong>{tierForRevenue(monthRevenue)} · {percentForTier(tierForRevenue(monthRevenue))}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, Math.round((monthRevenue / Math.max(silverGoal, 1)) * 100))}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">Lucro acumulado no mês: {yen(monthRevenue)}</p></div>
          </div>
          </>)}
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between"><div><h3 className="font-semibold">Carrinho da simulação</h3><p className="text-xs text-muted-foreground">Desconto somente nos produtos sem promoção.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{items.length} itens</span></div>
          {items.map((item, index) => (
            <div key={item.name} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">Quantidade: {item.quantity}</p></div><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.discounted} onChange={(e) => setItems((current) => current.map((value, i) => i === index ? { ...value, discounted: e.target.checked } : value))} /> Já em promoção (cupom não vale)</label></div>
              <div className="grid grid-cols-2 gap-2"><Input type="number" min="0" aria-label="Preço do item" value={item.price} onChange={(e) => { const price = Math.max(0, Number(e.target.value)); setItems((current) => current.map((value, i) => i === index ? { ...value, price, cost: Math.round(price / 2) } : value)); }} /><div className="rounded-md border bg-muted px-3 py-2 text-sm"><span className="block text-[10px] text-muted-foreground">Custo (50%)</span><strong>¥{item.cost.toLocaleString()}</strong></div></div>
              <p className="text-[11px] text-muted-foreground">Preço de venda · custo automático equivalente à metade do preço</p>
            </div>
          ))}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">O desconto do cupom é igual entrando por link ou por código: depende só dos itens. Item marcado como "Já em promoção" não recebe o cupom. O lucro e a comissão consideram todos os produtos pagos.</div>
        </div>
      </div>

      {!promoter && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi icon={ShoppingBag} label="Vendas de produtos (líquidas)" value={yen(month.net)} hint={`${history.length} compra(s) · antes do desconto: ${yen(month.gross)}`} />
            <Kpi icon={Tag} label="Desconto dado ao cliente" value={`−${yen(month.discount)}`} hint={month.gross > 0 ? `${pct(month.discount, month.gross)} do valor de tabela` : 'nenhuma compra ainda'} />
            <Kpi icon={Receipt} label="Custo dos produtos" value={yen(month.cost)} hint={month.net > 0 ? `${pct(month.cost, month.net)} da venda líquida` : undefined} />
            <Kpi icon={Coins} label="Lucro bruto (conta da meta)" value={yen(month.profit)} hint={month.net > 0 ? `margem ${pct(month.profit, month.net)}` : undefined} />
            <Kpi icon={HandCoins} tone="pink" label="A PAGAR ao afiliado" value={yen(month.commission)} hint={month.profit > 0 ? `${pct(month.commission, month.profit)} do lucro · ${pct(month.commission, month.net)} da venda` : 'liberada após a entrega'} />
            <Kpi icon={PiggyBank} tone="green" label="Seu lucro depois da comissão" value={yen(month.finalProfit)} hint={month.net > 0 ? `${pct(month.finalProfit, month.net)} da venda líquida` : undefined} />
            <Kpi icon={Truck} label="Frete, taxa PS e taxa de pagamento" value={`${month.extras >= 0 ? '+' : '−'}${yen(Math.abs(month.extras))}`} hint="saldo das despesas da venda (preencha ao lado)" />
            <Kpi icon={Wallet} tone="green" label="RESULTADO REAL do mês" value={yen(month.realProfit)} hint={month.net > 0 ? `${pct(month.realProfit, month.net)} da venda líquida` : 'lucro final somando frete e taxas'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="mb-1 flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4" /> Compra {purchaseCount + 1}: a conta passo a passo</h3>
              <p className="mb-3 text-xs text-muted-foreground">Prévia com o carrinho e o nível atuais. Clique em "Simular compra" para somar ao mês.</p>
              <Row label="Valor dos itens (preço de tabela)" value={yen(totals.subtotal)} />
              <Row label={`Desconto do cupom (${Math.max(0, Math.min(100, discountPercent))}% sobre ${yen(totals.eligibleForDiscount)} sem promoção)`} value={`−${yen(totals.discount)}`} tone="minus" />
              {totals.discount === 0 && discountPercent > 0 && (
                <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  {totals.eligibleForDiscount === 0
                    ? 'Desconto ¥0: todos os itens do carrinho estão marcados como "Já em promoção". O cupom do afiliado não vale em item que já tem desconto. Isso vale igual por link ou por código.'
                    : 'Desconto ¥0: confira o percentual do cupom.'}
                </p>
              )}
              <Row label="Cliente paga pelos produtos" value={yen(totals.netProducts)} strong />
              <Row label="Custo dos produtos" value={`−${yen(totals.productCost)}`} tone="minus" />
              <Row label="Lucro bruto" value={yen(totals.profit)} strong />
              <Row label={`Comissão do afiliado (${percentForTier(tierForRevenue(monthRevenue))}% do lucro · nível ${tierForRevenue(monthRevenue)})`} value={`−${yen(nextCommission)}`} tone="minus" />
              <Row label="Lucro dos produtos depois da comissão" value={yen(totals.profit - nextCommission)} strong tone="plus" />
              {(shippingCharged > 0 || shippingPaid > 0 || psFeeCharged > 0 || paymentFee > 0) && (<>
                {shippingCharged > 0 && <Row label="Frete cobrado do cliente" value={`+${yen(shippingCharged)}`} />}
                {shippingPaid > 0 && <Row label="Frete que você paga ao transportador" value={`−${yen(shippingPaid)}`} tone="minus" />}
                {psFeeCharged > 0 && <Row label="Taxa PS cobrada (¥1.000 por unidade)" value={`+${yen(psFeeCharged)}`} />}
                {paymentFee > 0 && <Row label={`Taxa do meio de pagamento (${feePercent}% de ${yen(customerPays)})`} value={`−${yen(paymentFee)}`} tone="minus" />}
                <Row label="Resultado real da venda" value={yen(totals.profit - nextCommission + extras)} strong tone="plus" />
              </>)}
              <p className="mt-2 text-[11px] text-muted-foreground">A comissão do afiliado é sempre calculada só sobre os produtos. Frete, taxa PS e taxa de pagamento aparecem quando preenchidos em "Despesas da venda". Câmbio não entra.</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <h3 className="mb-2 font-semibold">Nível do afiliado</h3>
                <div className="flex items-end justify-between"><strong className="text-xl">{tierForRevenue(monthRevenue)} · {percentForTier(tierForRevenue(monthRevenue))}%</strong><span className="text-xs text-muted-foreground">lucro no mês: {yen(monthRevenue)}</span></div>
                {nextGoal > 0 ? (<>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, Math.round((monthRevenue / Math.max(nextGoal, 1)) * 100))}%` }} /></div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Faltam <strong>{yen(missingProfit)}</strong> de lucro para o nível {nextTierName} (cerca de {yen(missingSales)} em vendas, com a margem desta cesta).</p>
                </>) : <p className="mt-1.5 text-xs text-muted-foreground">Nível máximo atingido neste mês.</p>}
              </div>
              <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
                <div><h3 className="font-semibold">Despesas da venda (opcional)</h3><p className="text-xs text-muted-foreground">Mostra o que sobra de verdade. Não muda a comissão do afiliado.</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Frete cobrado do cliente (¥)</Label><Input aria-label="Frete cobrado do cliente (¥)" type="number" min="0" value={shippingCharged} onChange={(e) => setShippingCharged(Math.max(0, Number(e.target.value)))} /></div>
                  <div className="space-y-1"><Label>Frete que você paga (¥)</Label><Input aria-label="Frete que você paga (¥)" type="number" min="0" value={shippingPaid} onChange={(e) => setShippingPaid(Math.max(0, Number(e.target.value)))} /></div>
                  <div className="space-y-1"><Label>Taxa do meio de pagamento (%)</Label><Input aria-label="Taxa do meio de pagamento (%)" type="number" min="0" max="100" step="0.1" value={feePercent} onChange={(e) => setFeePercent(Math.max(0, Number(e.target.value)))} /><p className="text-[11px] text-muted-foreground">Confira o % no seu painel do Stripe/Wise.</p></div>
                  <label className="flex items-center gap-2 self-end pb-6 text-sm"><input type="checkbox" aria-label="Cobrar taxa PS (¥1.000/un)" checked={psFeeOn} onChange={(e) => setPsFeeOn(e.target.checked)} /> Cobrar taxa PS (¥1.000/un)</label>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
                <div><Label>Forma de pagamento (só identifica a compra)</Label><div className="mt-1 flex flex-wrap gap-2">{['card', 'pix', 'bank', 'wise'].map((method) => <Button key={method} type="button" size="sm" variant={paymentMethod === method ? 'default' : 'outline'} onClick={() => setPaymentMethod(method)}>{method.toUpperCase()}</Button>)}</div></div>
                <div className="flex flex-wrap gap-2"><Button onClick={simulatePayment} className="gap-2"><ShieldCheck className="h-4 w-4" /> Simular compra</Button><Button onClick={resetMonth} variant="outline">Fechar mês / zerar</Button><Button onClick={reset} variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" /> Limpar teste</Button></div>
                <p className="text-xs text-muted-foreground">A comissão real só é liberada depois da confirmação da entrega. Nada é gravado neste Sandbox.</p>
              </div>
            </div>
          </div>

          {history.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="mb-3 font-semibold">Compras simuladas no mês</h3>
              <table className="w-full min-w-[640px] text-xs">
                <thead><tr className="border-b text-left text-muted-foreground">{['#', 'Pgto', 'Nível', 'Venda', 'Desconto', 'Custo', 'Lucro', 'Comissão', 'Seu lucro', 'Real'].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {history.map((x) => (
                    <tr key={x.n} className="border-b last:border-0 tabular-nums">
                      <td className="py-1.5 pr-3">{x.n}</td><td className="pr-3">{x.method.toUpperCase()} · {x.source === 'link' ? 'link' : 'código'}</td><td className="pr-3">{x.tier} {x.percent}%</td>
                      <td className="pr-3">{yen(x.net)}</td><td className="pr-3 text-green-700">−{yen(x.discount)}</td><td className="pr-3">{yen(x.cost)}</td><td className="pr-3">{yen(x.profit)}</td>
                      <td className="pr-3 font-semibold text-primary">{yen(x.commission)}</td><td className="pr-3 font-semibold">{yen(x.finalProfit)}</td><td className="font-bold text-green-700">{yen(x.realProfit)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold tabular-nums"><td className="pt-2 pr-3" colSpan={3}>Total do mês</td><td className="pr-3 pt-2">{yen(month.net)}</td><td className="pr-3 pt-2 text-green-700">−{yen(month.discount)}</td><td className="pr-3 pt-2">{yen(month.cost)}</td><td className="pr-3 pt-2">{yen(month.profit)}</td><td className="pr-3 pt-2 text-primary">{yen(month.commission)}</td><td className="pr-3 pt-2">{yen(month.finalProfit)}</td><td className="pt-2 text-green-700">{yen(month.realProfit)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {result && (
            <div role="status" className={`rounded-lg border p-3 text-sm font-medium ${/^(BLOQUEADO|NÃO CONTA|Informe)/.test(result) ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>{result}</div>
          )}
        </div>
      )}

      {promoter && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4" /> Resultado do pagamento simulado</h3>
          <div className="flex flex-wrap gap-2">{['card', 'pix', 'bank', 'wise'].map((method) => <Button key={method} type="button" variant={paymentMethod === method ? 'default' : 'outline'} onClick={() => setPaymentMethod(method)}>{method.toUpperCase()}</Button>)}</div>
          <div className="grid gap-2 text-sm md:grid-cols-4"><span>Subtotal: <strong>{yen(totals.subtotal)}</strong></span><span>Base cupom: <strong>{yen(totals.eligibleForDiscount)}</strong></span><span>Desconto: <strong className="text-green-600">−{yen(totals.discount)}</strong></span><span>Total: <strong>{yen(totals.total)}</strong></span></div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm dark:bg-sky-950/20">
            <p className="mb-2 flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Retorno do código {code || '—'}</p>
            <div className="grid gap-2 md:grid-cols-4">
              <span>Pessoas que vieram: <strong>{current.link + current.code}</strong><em className="block text-[11px] not-italic text-muted-foreground">{current.link} pelo link · {current.code} pelo código</em></span>
              <span>Compraram: <strong className="text-green-600">{current.buyers}</strong><em className="block text-[11px] not-italic text-muted-foreground">{current.link + current.code > 0 ? `${Math.round((current.buyers / (current.link + current.code)) * 100)}% de quem veio` : 'pedidos pagos'}</em></span>
              <span>Vendas geradas: <strong>{yen(current.revenue)}</strong></span>
              <span>Comissão: <strong>¥0</strong><em className="block text-[11px] not-italic text-muted-foreground">divulgador não tem comissão</em></span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Divulgador: sem comissão. Cada cadastro usa cada código uma única vez e cada pessoa conta uma vez como visita. Nada é gravado de verdade.</p>
          <div className="flex flex-wrap gap-2"><Button onClick={simulatePromoterPurchase} className="gap-2"><ShieldCheck className="h-4 w-4" /> Simular compra de {person}</Button><Button onClick={reset} variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" /> Limpar teste</Button></div>
          {result && (
            <div role="status" className={`rounded-lg border p-3 text-sm font-medium ${/^(BLOQUEADO|NÃO CONTA|Informe)/.test(result) ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>{result}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckoutSandbox;
