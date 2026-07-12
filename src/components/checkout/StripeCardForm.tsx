import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { AlertCircle, CreditCard, Loader2 } from 'lucide-react';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

interface StripeCardFormProps {
  orderId: string;
  amount: number;
  currency: string;
  email?: string;
  customerName?: string;
  itemCount?: number;
  onSuccess: () => void;
}

const CheckoutForm: React.FC<Pick<StripeCardFormProps, 'onSuccess'>> = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Não foi possível processar o pagamento.');
      setSubmitting(false);
      return;
    }

    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      onSuccess();
    } else {
      setError('Pagamento não confirmado. Tente novamente.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <PaymentElement />
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <Button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full btn-primary py-4 text-base font-bold rounded-xl gap-2"
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
        {submitting ? 'Processando...' : 'Pagar com Cartão'}
      </Button>
    </form>
  );
};

const StripeCardForm: React.FC<StripeCardFormProps> = ({ orderId, amount, currency, email, customerName, itemCount, onSuccess }) => {
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amount, currency, email, name: customerName, itemCount }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.clientSecret) setClientSecret(data.clientSecret);
        else setError(data?.error || 'Falha ao iniciar pagamento.');
      })
      .catch(() => { if (!cancelled) setError('Falha ao conectar com o servidor de pagamento.'); });
    return () => { cancelled = true; };
  }, [orderId, amount, currency]);

  if (!stripePromise) {
    return (
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Pagamento com cartão ainda não configurado. Use o Wise por enquanto.
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Preparando pagamento seguro...
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm onSuccess={onSuccess} />
    </Elements>
  );
};

export default StripeCardForm;
