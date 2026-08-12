import React, { useMemo, useState } from 'react';
import { CreditCard, FlaskConical, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SandboxItem = { name: string; price: number; quantity: number; discounted: boolean };

const initialItems: SandboxItem[] = [
  { name: 'Produto em promoção', price: 2000, quantity: 1, discounted: true },
  { name: 'Produto sem promoção', price: 3000, quantity: 1, discounted: false },
];

const CheckoutSandbox: React.FC = () => {
  const [items, setItems] = useState(initialItems);
  const [couponCode, setCouponCode] = useState('JUNIOR10');
  const [couponPercent, setCouponPercent] = useState(10);
  const [affiliateCode, setAffiliateCode] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [result, setResult] = useState('');

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const eligible = items.reduce((sum, item) => (
      !item.discounted || !affiliateCode ? sum + item.price * item.quantity : sum
    ), 0);
    const discount = Math.round(eligible * (Math.max(0, Math.min(100, couponPercent)) / 100));
    return { subtotal, eligible, discount, total: subtotal - discount };
  }, [affiliateCode, couponPercent, items]);

  const simulatePayment = () => {
    setResult(`SIMULAÇÃO OK — ${paymentMethod.toUpperCase()} — nenhum pagamento real foi enviado. Total simulado: ¥${totals.total.toLocaleString()}`);
  };

  const reset = () => {
    setItems(initialItems);
    setCouponCode('JUNIOR10');
    setCouponPercent(10);
    setAffiliateCode(true);
    setPaymentMethod('card');
    setResult('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-bold text-lg">Sandbox de cupons e pagamentos</h2>
            <p className="text-sm text-amber-800 dark:text-amber-200">Ambiente totalmente simulado. Não cria pedido, não grava cupom, não chama Stripe, Pix, banco, Wise ou qualquer meio de pagamento real.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold">Cupom e código de afiliado</h3>
          <div className="space-y-1">
            <Label>Código de teste</Label>
            <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="JUNIOR10" />
          </div>
          <div className="space-y-1">
            <Label>Desconto (%)</Label>
            <Input type="number" min="0" max="100" value={couponPercent} onChange={(e) => setCouponPercent(Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={affiliateCode} onChange={(e) => setAffiliateCode(e.target.checked)} className="h-4 w-4" />
            Simular código de afiliado (não acumula com produto promocional)
          </label>
          <p className="rounded-lg bg-muted p-3 text-xs">Código testado: <strong>{couponCode || '—'}</strong>. A validade não é consultada no Firestore; esta tela não altera dados reais.</p>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold">Itens simulados</h3>
          {items.map((item, index) => (
            <div key={item.name} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">¥{item.price.toLocaleString()} × {item.quantity}</p>
              </div>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={item.discounted} onChange={(e) => setItems((current) => current.map((value, i) => i === index ? { ...value, discounted: e.target.checked } : value))} />
                Promoção
              </label>
            </div>
          ))}
          <p className="text-xs text-blue-700">O desconto do afiliado incide apenas no item sem promoção quando o carrinho é misto.</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Pagamento simulado</h3>
        <div className="flex flex-wrap gap-2">
          {['card', 'pix', 'bank', 'wise'].map((method) => (
            <Button key={method} type="button" variant={paymentMethod === method ? 'default' : 'outline'} onClick={() => setPaymentMethod(method)}>{method.toUpperCase()}</Button>
          ))}
        </div>
        <div className="grid gap-2 text-sm md:grid-cols-4">
          <span>Subtotal: <strong>¥{totals.subtotal.toLocaleString()}</strong></span>
          <span>Base elegível: <strong>¥{totals.eligible.toLocaleString()}</strong></span>
          <span>Desconto: <strong className="text-green-600">−¥{totals.discount.toLocaleString()}</strong></span>
          <span>Total: <strong>¥{totals.total.toLocaleString()}</strong></span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={simulatePayment} className="gap-2"><ShieldCheck className="h-4 w-4" /> Simular pagamento</Button>
          <Button onClick={reset} variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" /> Limpar teste</Button>
        </div>
        {result && <p className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">{result}</p>}
      </div>
    </div>
  );
};

export default CheckoutSandbox;
