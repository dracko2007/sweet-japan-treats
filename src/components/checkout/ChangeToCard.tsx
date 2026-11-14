import React, { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StripeCardForm from '@/components/checkout/StripeCardForm';
import { changeOrderToCard, checkoutErrorMessage, CheckoutError } from '@/services/checkoutService';

interface ChangeToCardProps {
  orderId: string;
  /** Cartão aprovado: a tela de cima atualiza o pedido. */
  onPaid: () => void;
}

/** "Errei a forma de pagamento": troca um pedido Wise ainda pendente para cartão e já cobra. */
const ChangeToCard: React.FC<ChangeToCardProps> = ({ orderId, onPaid }) => {
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await changeOrderToCard(orderId);
      setClientSecret(result.clientSecret);
    } catch (err) {
      setError(checkoutErrorMessage(err instanceof CheckoutError ? err.message : 'checkout_failed'));
    } finally {
      setLoading(false);
    }
  };

  if (clientSecret) {
    return (
      <div className="space-y-3 rounded-2xl border border-pink-200 bg-pink-50/40 p-4 text-left">
        <p className="text-sm font-semibold">Pagar este pedido com cartão</p>
        <StripeCardForm clientSecret={clientSecret} onSuccess={onPaid} />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={start} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        Prefiro pagar com cartão
      </Button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default ChangeToCard;
