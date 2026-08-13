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
  const [affiliateSource, setAffiliateSource] = useState<'link' | 'code'>('link');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [result, setResult] = useState('');

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const eligibleForDiscount = items.reduce((sum, item) => (
      !item.discounted ? sum + item.price * item.quantity : sum
    ), 0);
    const discount = Math.round(eligibleForDiscount * (Math.max(0, Math.min(100, discountPercent)) / 100));
    const netProducts = subtotal - discount;
    const productCost = items.reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const profit = Math.max(0, netProducts - productCost);
    const commission = Math.round(profit * (Math.max(0, Math.min(100, commissionPercent)) / 100));
    return { subtotal, eligibleForDiscount, discount, netProducts, productCost, profit, commission, total: netProducts };
  }, [commissionPercent, discountPercent, items]);

  const simulatePayment = () => {
    setResult(`SIMULAÇÃO OK — ${paymentMethod.toUpperCase()} — ${affiliateSource === 'link' ? 'LINK' : 'CÓDIGO'} ${affiliateCode || '—'} — nenhum pagamento real foi enviado. Comissão pendente: ¥${totals.commission.toLocaleString()}`);
  };

  const reset = () => {
    setItems(initialItems);
    setAffiliateCode('JUNIOR10');
    setDiscountPercent(10);
    setCommissionPercent(10);
    setAffiliateSource('link');
    setPaymentMethod('card');
    setResult('');
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold">Afiliado</h3>
          <div className="space-y-1">
            <Label>Código de teste</Label>
            <Input value={affiliateCode} onChange={(e) => setAffiliateCode(e.target.value.toUpperCase())} placeholder="JUNIOR10" />
          </div>
          <div className="space-y-1">
            <Label>Origem da indicação</Label>
            <div className="flex gap-2">
              <Button type="button" variant={affiliateSource === 'link' ? 'default' : 'outline'} onClick={() => setAffiliateSource('link')}>Link ?ref=</Button>
              <Button type="button" variant={affiliateSource === 'code' ? 'default' : 'outline'} onClick={() => setAffiliateSource('code')}>Código no cupom</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Desconto (%)</Label><Input type="number" min="0" max="100" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Comissão (%)</Label><Input type="number" min="0" max="100" value={commissionPercent} onChange={(e) => setCommissionPercent(Number(e.target.value))} /></div>
          </div>
          <p className="rounded-lg bg-muted p-3 text-xs">Link e código usam a mesma regra de comissão neste teste. A comissão é calculada sobre o lucro: produtos após desconto − custo dos produtos.</p>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold">Itens simulados</h3>
          {items.map((item, index) => (
            <div key={item.name} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">Quantidade: {item.quantity}</p></div>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.discounted} onChange={(e) => setItems((current) => current.map((value, i) => i === index ? { ...value, discounted: e.target.checked } : value))} /> Promoção</label>
              </div>
              <div className="grid grid-cols-2 gap-2"><Input type="number" min="0" aria-label="Preço do item" value={item.price} onChange={(e) => setItems((current) => current.map((value, i) => i === index ? { ...value, price: Number(e.target.value) } : value))} /><Input type="number" min="0" aria-label="Custo do item" value={item.cost} onChange={(e) => setItems((current) => current.map((value, i) => i === index ? { ...value, cost: Number(e.target.value) } : value))} /></div>
              <p className="text-[11px] text-muted-foreground">Preço de venda · custo usado na comissão</p>
            </div>
          ))}
          <p className="text-xs text-blue-700">O cupom não acumula no produto promocional. O lucro e a comissão consideram todos os produtos pagos.</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Resultado do pagamento simulado</h3>
        <div className="flex flex-wrap gap-2">{['card', 'pix', 'bank', 'wise'].map((method) => <Button key={method} type="button" variant={paymentMethod === method ? 'default' : 'outline'} onClick={() => setPaymentMethod(method)}>{method.toUpperCase()}</Button>)}</div>
        <div className="grid gap-2 text-sm md:grid-cols-4"><span>Subtotal: <strong>¥{totals.subtotal.toLocaleString()}</strong></span><span>Base cupom: <strong>¥{totals.eligibleForDiscount.toLocaleString()}</strong></span><span>Desconto: <strong className="text-green-600">−¥{totals.discount.toLocaleString()}</strong></span><span>Total: <strong>¥{totals.total.toLocaleString()}</strong></span></div>
        <div className="grid gap-2 rounded-lg bg-secondary/40 p-3 text-sm md:grid-cols-3"><span>Custo: <strong>¥{totals.productCost.toLocaleString()}</strong></span><span>Lucro líquido: <strong>¥{totals.profit.toLocaleString()}</strong></span><span>Comissão: <strong className="text-primary">¥{totals.commission.toLocaleString()}</strong></span></div>
        <p className="text-xs text-muted-foreground">A comissão é liberada depois da confirmação da entrega. Nenhuma comissão real é criada neste Sandbox.</p>
        <div className="flex flex-wrap gap-2"><Button onClick={simulatePayment} className="gap-2"><ShieldCheck className="h-4 w-4" /> Simular pagamento</Button><Button onClick={reset} variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" /> Limpar teste</Button></div>
        {result && <p className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">{result}</p>}
      </div>
    </div>
  );
};

export default CheckoutSandbox;
