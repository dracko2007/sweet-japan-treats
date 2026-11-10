import React, { useState } from 'react';
import { Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { newsletterService } from '@/services/newsletterService';

/** Captação de e-mail na home — mesmo serviço de leads já usado no popup de saída. */
const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'invalid'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setStatus('invalid');
      return;
    }
    setStatus('loading');
    await newsletterService.capture({ email: value, source: 'newsletter_footer' });
    setStatus('done');
    setEmail('');
  };

  return (
    <section className="py-12 md:py-16 bg-pink-50">
      <div className="container mx-auto px-4">
        <div className="max-w-xl mx-auto text-center text-foreground">
          <Mail className="w-10 h-10 mx-auto mb-3 text-primary" />
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">
            Fique por dentro das novidades
          </h2>
          <p className="text-muted-foreground mb-6">
            Receba avisos de novos produtos e promoções direto no seu e-mail.
          </p>

          {status === 'done' ? (
            <div className="flex items-center justify-center gap-2 bg-white border border-pink-200 text-primary rounded-xl py-3.5 px-5 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Inscrição confirmada! Obrigado 🎉
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (status === 'invalid') setStatus('idle'); }}
                placeholder="seu@email.com"
                className="flex-1 rounded-xl border border-pink-200 bg-white px-4 py-3 text-gray-900 font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl px-6 py-3 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Inscrever'}
              </button>
            </form>
          )}
          {status === 'invalid' && (
            <p className="text-sm text-destructive mt-2 font-medium">Digite um e-mail válido.</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
