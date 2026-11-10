import React, { useMemo, useState } from 'react';
import { CreditCard, FlaskConical, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SandboxItem = { name: string; price: number; cost: number; quantity: number; discounted: boolean };

const initialItems: SandboxItem[] = [
  { name: 'Produto em promoção', price: 2000, cost: 1000, quantity: 1, discounted: true },
  { name: 'Produto sem promoção', price: 3000, cost: 1500, quantity: 1, discounted: false },
];

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
  const [simulatedCommission, setSimulatedCommission] = useState(0);
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

  const simulatePayment = () => {
    const tierBefore = tierForRevenue(monthRevenue);
    const saleCommissionPercent = percentForTier(tierBefore);
    const commission = Math.round(totals.profit * saleCommissionPercent / 100);
    const nextRevenue = monthRevenue + totals.profit;
    const nextTier = tierForRevenue(nextRevenue);
    setPurchaseCount((value) => value + 1);
    setMonthRevenue(nextRevenue);
    setSimulatedCommission((value) => value + commission);
    setResult(`COMPRA ${purchaseCount + 1} SIMULADA — ${paymentMethod.toUpperCase()} — ${affiliateSource === 'link' ? 'LINK' : 'CÓDIGO'} ${affiliateCode || '—'} — nível da compra: ${tierBefore} (${saleCommissionPercent}%) — comissão: ¥${commission.toLocaleString()} — próximo nível: ${nextTier}`);
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
    setSimulatedCommission(0);
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
    setSimulatedCommission(0);
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
            <div><h3 className="font-semibold">Metas do mês</h3><p className="text-xs text-muted-foreground">A próxima compra usa o novo nível após a meta ser atingida.</p></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Meta Prata (¥)</Label><Input type="number" min="0" value={bronzeGoal} onChange={(e) => setBronzeGoal(Number(e.target.value))} /></div><div className="space-y-1"><Label>Meta Ouro (¥)</Label><Input type="number" min="0" value={silverGoal} onChange={(e) => setSilverGoal(Number(e.target.value))} /></div></div>
            <div className="rounded-xl bg-secondary/50 p-3 text-sm"><div className="flex justify-between"><span>Nível atual</span><strong>{tierForRevenue(monthRevenue)} · {percentForTier(tierForRevenue(monthRevenue))}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.round((monthRevenue / Math.max(silverGoal, 1)) * 100))}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">Vendas no mês: ¥{monthRevenue.toLocaleString()}</p></div>
          </div>
          </>)}
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between"><div><h3 className="font-semibold">Carrinho da simulação</h3><p className="text-xs text-muted-foreground">Desconto somente nos produtos sem promoção.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{items.length} itens</span></div>
          {items.map((item, index) => (
            <div key={item.name} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">Quantidade: {item.quantity}</p></div><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.discounted} onChange={(e) => setItems((current) => current.map((value, i) => i === index ? { ...value, discounted: e.target.checked } : value))} /> Promoção</label></div>
              <div className="grid grid-cols-2 gap-2"><Input type="number" min="0" aria-label="Preço do item" value={item.price} onChange={(e) => { const price = Math.max(0, Number(e.target.value)); setItems((current) => current.map((value, i) => i === index ? { ...value, price, cost: Math.round(price / 2) } : value)); }} /><div className="rounded-md border bg-muted px-3 py-2 text-sm"><span className="block text-[10px] text-muted-foreground">Custo (50%)</span><strong>¥{item.cost.toLocaleString()}</strong></div></div>
              <p className="text-[11px] text-muted-foreground">Preço de venda · custo automático equivalente à metade do preço</p>
            </div>
          ))}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">O cupom não acumula no produto promocional. O lucro e a comissão consideram todos os produtos pagos.</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Resultado do pagamento simulado</h3>
        <div className="flex flex-wrap gap-2">{['card', 'pix', 'bank', 'wise'].map((method) => <Button key={method} type="button" variant={paymentMethod === method ? 'default' : 'outline'} onClick={() => setPaymentMethod(method)}>{method.toUpperCase()}</Button>)}</div>
        <div className="grid gap-2 text-sm md:grid-cols-4"><span>Subtotal: <strong>¥{totals.subtotal.toLocaleString()}</strong></span><span>Base cupom: <strong>¥{totals.eligibleForDiscount.toLocaleString()}</strong></span><span>Desconto: <strong className="text-green-600">−¥{totals.discount.toLocaleString()}</strong></span><span>Total: <strong>¥{totals.total.toLocaleString()}</strong></span></div>
        {promoter && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm dark:bg-sky-950/20">
            <p className="mb-2 flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Retorno do código {code || '—'}</p>
            <div className="grid gap-2 md:grid-cols-4">
              <span>Pessoas que vieram: <strong>{current.link + current.code}</strong><em className="block text-[11px] not-italic text-muted-foreground">{current.link} pelo link · {current.code} pelo código</em></span>
              <span>Compraram: <strong className="text-green-600">{current.buyers}</strong><em className="block text-[11px] not-italic text-muted-foreground">{current.link + current.code > 0 ? `${Math.round((current.buyers / (current.link + current.code)) * 100)}% de quem veio` : 'pedidos pagos'}</em></span>
              <span>Vendas geradas: <strong>¥{current.revenue.toLocaleString()}</strong></span>
              <span>Comissão: <strong>¥0</strong><em className="block text-[11px] not-italic text-muted-foreground">divulgador não tem comissão</em></span>
            </div>
          </div>
        )}
        {!promoter && (<div className="grid gap-2 rounded-lg bg-secondary/40 p-3 text-sm md:grid-cols-4"><span>Custo: <strong>¥{totals.productCost.toLocaleString()}</strong></span><span>Lucro líquido: <strong>¥{totals.profit.toLocaleString()}</strong></span><span>Vendas no mês: <strong>¥{monthRevenue.toLocaleString()}</strong></span><span>Comissão acumulada: <strong className="text-primary">¥{simulatedCommission.toLocaleString()}</strong></span></div>)}
        {!promoter && (<>
        <p className="text-xs text-muted-foreground">Compra {purchaseCount + 1}: nível {tierForRevenue(monthRevenue)} ({percentForTier(tierForRevenue(monthRevenue))}%). A próxima compra muda de porcentagem depois de atingir a meta.</p>
        <p className="text-xs text-muted-foreground">A comissão é liberada depois da confirmação da entrega. Nenhuma comissão real é criada neste Sandbox.</p>
        </>)}
        {promoter && <p className="text-xs text-muted-foreground">Divulgador: sem comissão. Cada cadastro usa cada código uma única vez e cada pessoa conta uma vez como visita. Nada é gravado de verdade.</p>}
        <div className="flex flex-wrap gap-2"><Button onClick={promoter ? simulatePromoterPurchase : simulatePayment} className="gap-2"><ShieldCheck className="h-4 w-4" /> {promoter ? `Simular compra de ${person}` : 'Simular compra'}</Button>{!promoter && <Button onClick={resetMonth} variant="outline">Fechar mês / zerar</Button>}<Button onClick={reset} variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" /> Limpar teste</Button></div>
        {result && (
          <div role="status" className={`rounded-lg border p-3 text-sm font-medium ${/^(BLOQUEADO|NÃO CONTA|Informe)/.test(result) ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>{result}</div>
        )}
      </div>
    </div>
  );
};

export default CheckoutSandbox;
