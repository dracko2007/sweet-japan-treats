import React, { useState } from 'react';
import { Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { newsletterService } from '@/services/newsletterService';

/** Captação de e-mail na home — mesmo serviço de leads já usado no popup de saída. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Status = 'idle' | 'loading' | 'done' | 'invalid' | 'failed';

const NewsletterSection: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const isValid = (raw: string) => EMAIL_RE.test(raw.trim().toLowerCase());

  // Valida ao sair do campo (não a cada tecla) e só se algo foi digitado.
  const handleBlur = () => {
    if (email.trim() && !isValid(email)) setStatus('invalid');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!isValid(value)) {
      setStatus('invalid');
      return;
    }
    setStatus('loading');
    // capture() devolve false em falha de rede/Firestore: não confirmar uma
    // inscrição que não foi salva.
    const ok = await newsletterService.capture({ email: value, source: 'newsletter_footer' }).catch(() => false);
    if (!ok) {
      setStatus('failed');
      return;
    }
    setStatus('done');
    setEmail('');
  };

  const showError = status === 'invalid' || status === 'failed';

  const Wrapper: React.ElementType = embedded ? 'div' : 'section';
  return (
    <Wrapper className={embedded ? 'border-t border-pink-100 pt-10' : 'py-12 md:py-16 bg-pink-50'}>
      <div className={embedded ? '' : 'container mx-auto px-4'}>
        <div className="max-w-xl mx-auto text-center text-foreground">
          <Mail className="w-8 h-8 mx-auto mb-3 text-primary" aria-hidden="true" />
          <h3 className="font-display text-xl md:text-2xl font-bold mb-2">
            Fique por dentro das novidades
          </h3>
          <p className="text-muted-foreground mb-6">
            Receba avisos de novos produtos e promoções direto no seu e-mail.
          </p>

          {status === 'done' ? (
            <div role="status" className="flex items-center justify-center gap-2 bg-white border border-pink-200 text-primary rounded-xl py-3.5 px-5 font-semibold">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              Inscrição confirmada! Obrigado 🎉
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="text-left">
              <label htmlFor="newsletter-email" className="mb-1.5 block text-sm font-semibold text-foreground">
                Seu e-mail
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="newsletter-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (showError) setStatus('idle'); }}
                  onBlur={handleBlur}
                  placeholder="nome@exemplo.com"
                  aria-invalid={status === 'invalid'}
                  aria-describedby={showError ? 'newsletter-email-error' : undefined}
                  className={`flex-1 rounded-xl border bg-white px-4 py-3 text-gray-900 font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary ${
                    status === 'invalid' ? 'border-destructive' : 'border-pink-200'
                  }`}
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="min-h-[48px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl px-6 py-3 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" aria-label="Enviando" /> : 'Receber novidades'}
                </button>
              </div>
              {showError && (
                <p id="newsletter-email-error" role="alert" className="text-sm text-destructive mt-2 font-medium">
                  {status === 'invalid'
                    ? 'Esse e-mail parece incompleto. Confira o @ e o domínio, como em nome@gmail.com.'
                    : 'Não conseguimos salvar sua inscrição agora. Tente de novo em alguns segundos.'}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </Wrapper>
  );
};

export default NewsletterSection;
