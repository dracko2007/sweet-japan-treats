import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Download, Mail, CheckCircle2, Loader2, ShoppingBag, Gift } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { newsletterService } from '@/services/newsletterService';
import { psFeeWaiver } from '@/utils/psFeeWaiver';
import { safeStorage } from '@/utils/storage';
import type { CartItem } from '@/types';

const MARKETING_KEY = 'exit_popup_shown';      // oferta/guia/retenção simples — 1× por sessão
const WARN_KEY = 'exit_waiver_warn_shown';     // aviso de perda da isenção — 1× por sessão
const GUIDE_COOLDOWN_KEY = 'exit_intent_shown_at';
const GUIDE_COOLDOWN_DAYS = 14;
const MIN_TIME_ON_PAGE_MS = 6000;

// Funil de checkout = /checkout + /order-review (revisão/pagamento).
const inFunnel = (p: string): boolean => p.startsWith('/checkout') || p.startsWith('/order-review');

type Variant = 'retention' | 'waiver_warning' | 'ps_offer' | 'guide';

const flagGet = (k: string): boolean => {
  try { return sessionStorage.getItem(k) === '1'; } catch { return false; }
};
const flagSet = (k: string): void => {
  try { sessionStorage.setItem(k, '1'); } catch { /* noop */ }
};

// Quantidade de itens que pagam taxa PS (¥1.000/un): exclui brindes e isentos (noPsFee).
const psFeeQtyOf = (list: CartItem[]): number =>
  list.reduce((s, i) => (i.freeGift || i.product?.noPsFee) ? s : s + i.quantity, 0);

// Moldura do modal (overlay + cartão + botão fechar). Definida no nível do módulo
// para NÃO remontar a subárvore a cada render (senão o input de e-mail perde o foco).
const Shell: React.FC<{ label: string; onClose: () => void; children: React.ReactNode }> = ({
  label,
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    role="dialog"
    aria-modal="true"
    aria-label={label}
  >
    <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
      <button
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-3 top-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
      >
        <X className="w-5 h-5" />
      </button>
      {children}
    </div>
  </div>
);

/**
 * Popup de saída (exit-intent). Dispara NO MÁXIMO uma vez por sessão e NUNCA reabre
 * depois de fechado — acaba com a sensação de "vírus" de reaparecer toda hora.
 *
 * O conteúdo depende de onde o cliente está ao tentar sair:
 *  - /checkout  → lembrete para não abandonar o pedido (ponto 1).
 *  - fora do checkout + carrinho com itens que pagam taxa PS → oferta: finalize agora
 *    e a Taxa de Personal Shopper sai de graça (ponto 2). Aceitar leva ao checkout
 *    com a isenção ativa (ver utils/psFeeWaiver).
 *  - fora do checkout + carrinho sem taxa → guia por e-mail (lead, só visitante não
 *    logado e respeitando cooldown de 14 dias).
 *
 * Desktop: detecta o mouse saindo pelo topo. Mobile: tempo na página + scroll.
 */
const ExitIntentPopup: React.FC = () => {
  const { isAuthenticated } = useUser();
  const { items } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<Variant>('guide');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  // Refs sempre atualizados para uso DENTRO dos listeners (evita stale closure).
  const itemsRef = useRef(items);
  const pathRef = useRef(location.pathname);
  const authRef = useRef(isAuthenticated);
  itemsRef.current = items;
  pathRef.current = location.pathname;
  authRef.current = isAuthenticated;

  // Evita abrir um segundo popup enquanto um já está aberto.
  const openRef = useRef(false);
  openRef.current = open;

  // Decide qual popup mostrar no momento da saída (lê dados frescos via refs).
  const resolveVariant = useCallback((): Variant | null => {
    const list = itemsRef.current;
    if (inFunnel(pathRef.current)) return list.length > 0 ? 'retention' : null; // ponto 1
    if (psFeeQtyOf(list) > 0) return 'ps_offer';                 // ponto 2
    // Fallback: guia por e-mail (lead) — só visitante não logado e fora do cooldown.
    if (authRef.current) return null;
    const last = Number(safeStorage.getItem(GUIDE_COOLDOWN_KEY) || 0);
    if (Date.now() - last <= GUIDE_COOLDOWN_DAYS * 86400000) return null;
    return 'guide';
  }, []);

  const trigger = useCallback(() => {
    if (openRef.current) return;                 // já há um popup aberto
    let v = resolveVariant();
    if (!v) return;
    // No checkout com isenção ativa, o lembrete vira AVISO de perda da isenção.
    if (v === 'retention' && psFeeWaiver.isActive()) v = 'waiver_warning';

    if (v === 'waiver_warning') {
      if (flagGet(WARN_KEY)) return;             // aviso 1× por sessão (chave própria)
      flagSet(WARN_KEY);
    } else {
      if (flagGet(MARKETING_KEY)) return;        // oferta/guia/retenção 1× por sessão
      flagSet(MARKETING_KEY);
      if (v === 'guide') safeStorage.setItem(GUIDE_COOLDOWN_KEY, String(Date.now()));
    }
    setVariant(v);
    setOpen(true);
  }, [resolveVariant]);

  useEffect(() => {
    const start = Date.now();

    const onMouseOut = (e: MouseEvent) => {
      if (Date.now() - start < MIN_TIME_ON_PAGE_MS) return;
      if (e.clientY <= 0 && !e.relatedTarget) trigger();
    };

    const isTouch = window.matchMedia('(hover: none)').matches;
    let mobileTimer: ReturnType<typeof setTimeout> | null = null;
    let scrolled = false;
    const onScroll = () => { scrolled = true; };

    if (isTouch) {
      window.addEventListener('scroll', onScroll, { passive: true });
      mobileTimer = setTimeout(() => { if (scrolled) trigger(); }, 35000);
    } else {
      document.addEventListener('mouseout', onMouseOut);
    }

    return () => {
      document.removeEventListener('mouseout', onMouseOut);
      window.removeEventListener('scroll', onScroll);
      if (mobileTimer) clearTimeout(mobileTimer);
    };
  }, [trigger]);

  // Sair do funil de checkout sem finalizar invalida a isenção: ela vale só para
  // fechamento imediato. Progredir /checkout → /order-review NÃO invalida.
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    const prev = prevPathRef.current;
    const cur = location.pathname;
    if (inFunnel(prev) && !inFunnel(cur)) psFeeWaiver.clear();
    prevPathRef.current = cur;
  }, [location.pathname]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  // Aceitar a oferta: concede a isenção da taxa PS e leva ao checkout para finalizar.
  const acceptPsOffer = useCallback(() => {
    psFeeWaiver.grant();
    close();
    navigate('/checkout');
  }, [close, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      toast({ title: 'E-mail inválido', description: 'Digite um e-mail válido para receber o guia.' });
      return;
    }
    setStatus('loading');
    await newsletterService.capture({ email: value, source: 'exit_intent' });
    setStatus('done');
    setTimeout(() => setOpen(false), 2500);
  };

  if (!open) return null;

  const psFeeQty = psFeeQtyOf(items);
  const psFeeYen = psFeeQty * 1000;

  // ----- Ponto 1: retenção no checkout -----
  if (variant === 'retention') {
    return (
      <Shell label="Finalize seu pedido" onClose={close}>
        <div className="bg-gradient-to-br from-pink-600 to-amber-500 p-6 text-center text-white">
          <ShoppingBag className="w-10 h-10 mx-auto mb-2" />
          <h2 className="text-xl font-black leading-tight">Seu pedido está quase pronto!</h2>
          <p className="text-sm text-white/90 mt-1">
            Falta só um passo para concluir. Não perca os itens que você já escolheu.
          </p>
        </div>
        <div className="p-6 space-y-3">
          <button
            onClick={close}
            className="w-full bg-gradient-to-r from-pink-600 to-amber-500 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Voltar ao pedido
          </button>
          <p className="text-[11px] text-center text-gray-400">Seus itens continuam guardados no carrinho.</p>
        </div>
      </Shell>
    );
  }

  // ----- Aviso: sair do checkout invalida a isenção já aceita -----
  if (variant === 'waiver_warning') {
    return (
      <Shell label="Isenção válida só para finalização imediata" onClose={close}>
        <div className="bg-gradient-to-br from-pink-600 to-amber-500 p-6 text-center text-white">
          <Gift className="w-10 h-10 mx-auto mb-2" />
          <h2 className="text-xl font-black leading-tight">Sua isenção vale só agora!</h2>
          <p className="text-sm text-white/90 mt-1">
            A <strong>Taxa de Personal Shopper</strong>{psFeeYen > 0 && <> de <strong>¥ {psFeeYen.toLocaleString()}</strong></>} está
            isenta <strong>apenas para fechamento imediato</strong>. Se sair desta página agora,
            a isenção perde a validade e a taxa volta a ser cobrada.
          </p>
        </div>
        <div className="p-6 space-y-3">
          <button
            onClick={close}
            className="w-full bg-gradient-to-r from-pink-600 to-amber-500 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Voltar e finalizar agora
          </button>
          <p className="text-[11px] text-center text-gray-400">Conclua o pedido para garantir a isenção.</p>
        </div>
      </Shell>
    );
  }

  // ----- Ponto 2: oferta de isenção da taxa PS fora do checkout -----
  if (variant === 'ps_offer') {
    return (
      <Shell label="Oferta: taxa de Personal Shopper grátis" onClose={close}>
        <div className="bg-gradient-to-br from-pink-600 to-amber-500 p-6 text-center text-white">
          <Gift className="w-10 h-10 mx-auto mb-2" />
          <h2 className="text-xl font-black leading-tight">Finalize agora e a taxa sai de graça!</h2>
          <p className="text-sm text-white/90 mt-1">
            Conclua seu pedido <strong>agora, nesta visita</strong>, e nós <strong>isentamos a Taxa de
            Personal Shopper</strong>{psFeeYen > 0 && <> de <strong>¥ {psFeeYen.toLocaleString()}</strong></>}.
          </p>
        </div>
        <div className="p-6 space-y-3">
          <button
            onClick={acceptPsOffer}
            className="w-full bg-gradient-to-r from-pink-600 to-amber-500 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {psFeeYen > 0 ? `Finalizar agora e economizar ¥ ${psFeeYen.toLocaleString()}` : 'Finalizar agora'}
          </button>
          <button
            onClick={close}
            className="w-full text-sm text-gray-500 dark:text-gray-400 font-medium py-2 hover:underline"
          >
            Agora não
          </button>
          <p className="text-[11px] text-center text-gray-400">
            Isenção válida só para fechamento imediato — ao sair da página, ela perde a validade.
          </p>
        </div>
      </Shell>
    );
  }

  // ----- Fallback: cadastro com pontos e cupons (só não-logados) -----
  const handleCadastro = useCallback(() => {
    close();
    navigate('/cadastro');
  }, [close, navigate]);

  return (
    <Shell label="Cadastre-se e ganhe recompensas" onClose={close}>
      <div className="bg-gradient-to-br from-pink-600 to-amber-500 p-6 text-center text-white">
        <Gift className="w-10 h-10 mx-auto mb-2" />
        <h2 className="text-xl font-black leading-tight">
          Cadastre e ganhe pontos e cupons de desconto
        </h2>
        <p className="text-sm text-white/90 mt-1">
          Crie sua conta agora e receba imediatamente: cupom de boas-vindas 10% OFF + pontos de fidelidade para próximas compras.
        </p>
      </div>
      <div className="p-6 space-y-3">
        <button
          onClick={handleCadastro}
          className="w-full bg-gradient-to-r from-pink-600 to-amber-500 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          Cadastrar agora
        </button>
        <button
          onClick={close}
          className="w-full text-sm text-gray-500 dark:text-gray-400 font-medium py-2 hover:underline"
        >
          Agora não
        </button>
        <p className="text-[11px] text-center text-gray-400">Leva menos de 1 minuto. Sem cartão de crédito.</p>
      </div>
    </Shell>
  );
};

export default ExitIntentPopup;
