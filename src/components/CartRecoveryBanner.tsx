import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, X, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { cartAbandonmentService } from '@/services/cartAbandonmentService';

const DISMISS_KEY = 'cart_recovery_dismissed_at';

/**
 * Banner de recuperação de carrinho abandonado. Aparece quando o cliente
 * retorna à loja após >1h com itens deixados para trás. Clicando, leva direto
 * ao carrinho. Dismissível por 7 dias para não repetir.
 */
const CartRecoveryBanner: React.FC = () => {
  const navigate = useNavigate();
  const { items } = useCart();
  const { user } = useUser();
  const [abandoned, setAbandoned] = useState<{ itemCount: number; items: Array<{ name: string }> } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Só mostra se o carrinho ATUAL está vazio (usuário voltou sem os itens).
    if (items.length > 0) {
      cartAbandonmentService.markRecovered();
      return;
    }
    const dismissed = Number(safeStorageGet(DISMISS_KEY) || 0);
    if (Date.now() - dismissed < 7 * 86400000) return;

    const found = cartAbandonmentService.getAbandoned();
    if (found) {
      setAbandoned({ itemCount: found.itemCount, items: found.items.slice(0, 3) });
      setVisible(true);
    }
  }, [items.length]);

  const dismiss = () => {
    safeStorageSet(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const goToCart = () => {
    cartAbandonmentService.markRecovered();
    navigate('/carrinho');
  };

  if (!visible || !abandoned) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border-2 border-pink-400 overflow-hidden">
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute right-2 top-2 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 z-10"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="bg-gradient-to-r from-pink-600 to-amber-500 px-4 py-3 text-white flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          <p className="font-bold text-sm">Você deixou {abandoned.itemCount} {abandoned.itemCount === 1 ? 'item' : 'itens'} no carrinho! 🛒</p>
        </div>
        <div className="p-4">
          <div className="space-y-1 mb-3">
            {abandoned.items.map((it, i) => (
              <p key={i} className="text-sm text-gray-700 dark:text-gray-300 truncate">
                • {it.name}
              </p>
            ))}
            {abandoned.itemCount > 3 && (
              <p className="text-xs text-muted-foreground">e mais {abandoned.itemCount - 3}...</p>
            )}
          </div>
          <button
            onClick={goToCart}
            className="w-full bg-gradient-to-r from-pink-600 to-amber-500 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm"
          >
            Voltar ao meu carrinho <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const safeStorageGet = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const safeStorageSet = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
};

export default CartRecoveryBanner;
