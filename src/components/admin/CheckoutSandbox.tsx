import React, { useMemo, useState } from 'react';
import { CreditCard, FlaskConical, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SandboxItem = { name: string; price: number; cost: number; quantity: number; discounted: boolean };

const initialItems: SandboxItem[] = [
  { name: 'Produto em promoção', price: 2000, cost: 1200, quantity: 1, discounted: true },
  { name: 'Produto sem promoção', price: 3000, cost: 1800, quantity: 1, discounted: false },
];

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
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between"><div><h3 className="font-semibold">Carrinho da simulação</h3><p className="text-xs text-muted-foreground">Desconto somente nos produtos sem promoção.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{items.length} itens</span></div>
          {items.map((item, index) => (
            <div key={item.name} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">Quantidade: {item.quantity}</p></div><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.discounted} onChange={(e) => setItems((current) => current.map((value, i) => i === index ? { ...value, discounted: e.target.checked } : value))} /> Promoção</label></div>
              <div className="grid grid-cols-2 gap-2"><Input type="number" min="0" aria-label="Preço do item" value={item.price} onChange={(e) => setItems((current) => current.map((value, i) => i === index ? { ...value, price: Number(e.target.value) } : value))} /><Input type="number" min="0" aria-label="Custo do item" value={item.cost} onChange={(e) => setItems((current) => current.map((value, i) => i === index ? { ...value, cost: Number(e.target.value) } : value))} /></div>
              <p className="text-[11px] text-muted-foreground">Preço de venda · custo usado na comissão</p>
            </div>
          ))}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">O cupom não acumula no produto promocional. O lucro e a comissão consideram todos os produtos pagos.</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Resultado do pagamento simulado</h3>
        <div className="flex flex-wrap gap-2">{['card', 'pix', 'bank', 'wise'].map((method) => <Button key={method} type="button" variant={paymentMethod === method ? 'default' : 'outline'} onClick={() => setPaymentMethod(method)}>{method.toUpperCase()}</Button>)}</div>
        <div className="grid gap-2 text-sm md:grid-cols-4"><span>Subtotal: <strong>¥{totals.subtotal.toLocaleString()}</strong></span><span>Base cupom: <strong>¥{totals.eligibleForDiscount.toLocaleString()}</strong></span><span>Desconto: <strong className="text-green-600">−¥{totals.discount.toLocaleString()}</strong></span><span>Total: <strong>¥{totals.total.toLocaleString()}</strong></span></div>
        <div className="grid gap-2 rounded-lg bg-secondary/40 p-3 text-sm md:grid-cols-4"><span>Custo: <strong>¥{totals.productCost.toLocaleString()}</strong></span><span>Lucro líquido: <strong>¥{totals.profit.toLocaleString()}</strong></span><span>Vendas no mês: <strong>¥{monthRevenue.toLocaleString()}</strong></span><span>Comissão acumulada: <strong className="text-primary">¥{simulatedCommission.toLocaleString()}</strong></span></div>
        <p className="text-xs text-muted-foreground">Compra {purchaseCount + 1}: nível {tierForRevenue(monthRevenue)} ({percentForTier(tierForRevenue(monthRevenue))}%). A próxima compra muda de porcentagem depois de atingir a meta.</p>
        <p className="text-xs text-muted-foreground">A comissão é liberada depois da confirmação da entrega. Nenhuma comissão real é criada neste Sandbox.</p>
        <div className="flex flex-wrap gap-2"><Button onClick={simulatePayment} className="gap-2"><ShieldCheck className="h-4 w-4" /> Simular compra</Button><Button onClick={resetMonth} variant="outline">Fechar mês / zerar</Button><Button onClick={reset} variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" /> Limpar teste</Button></div>
      </div>
    </div>
  );
};

export default CheckoutSandbox;
