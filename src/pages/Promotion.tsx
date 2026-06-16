import React, { useEffect, useState } from 'react';
import { ShoppingCart, Sparkles, ArrowLeft, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useProducts } from '@/context/ProductsContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { useLanguage } from '@/context/LanguageContext';
import { getCurrencyByCountry, formatPrice } from '@/utils/currency';
import { convertYen } from '@/services/fxService';
import { ActivePromo, ScheduledNextPromo, PROMO_TYPES } from '@/components/admin/PromotionManager';

const BOUGHT_KEY = (id: string) => `promo_bought_${id}`;

function useCountdown(expiresAt: number | null | undefined) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!expiresAt) { setLabel(''); return; }
    const update = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) { setLabel('Encerrada'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return label;
}

async function tryActivateNext(next: ScheduledNextPromo) {
  if (!db) return;
  try {
    const expiresAt = next.durationDays ? Date.now() + next.durationDays * 86400000 : null;
    await setDoc(doc(db, 'siteContent', 'homePromotion'), { ...next, expiresAt, nextPromo: null });
  } catch { /* sem auth de usuário comum — admin ativa manualmente */ }
}

const Promotion: React.FC = () => {
  const [promo, setPromo] = useState<ActivePromo | null | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const [mainImg, setMainImg] = useState(0);
  const { addToCart } = useCart();
  const { products } = useProducts();
  const { toast } = useToast();
  const { selectedCountry } = useLanguage();
  const countdown = useCountdown(promo?.expiresAt);

  useEffect(() => {
    if (!db) { setPromo(null); return; }
    getDoc(doc(db, 'siteContent', 'homePromotion')).then(snap => {
      if (!snap.exists()) { setPromo(null); return; }
      const data = snap.data() as ActivePromo;
      // Verifica expiração
      if (data.expiresAt && data.expiresAt < Date.now()) {
        if (data.nextPromo) tryActivateNext(data.nextPromo).then(() => setPromo(null));
        else setPromo(null);
      } else {
        setPromo(data);
      }
    }).catch(() => setPromo(null));
  }, []);

  if (promo === undefined) return (
    <Layout>
      <div className="container mx-auto px-4 py-24 flex justify-center">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    </Layout>
  );

  if (!promo) return (
    <Layout>
      <div className="container mx-auto px-4 py-24 text-center space-y-4">
        <Sparkles className="w-12 h-12 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-bold">Nenhuma promoção ativa no momento.</h1>
        <p className="text-muted-foreground">Volte em breve para ofertas exclusivas!</p>
        <Button asChild variant="outline"><Link to="/produtos"><ArrowLeft className="w-4 h-4 mr-2" />Ver produtos</Link></Button>
      </div>
    </Layout>
  );

  const product = products.find(p => p.id === promo.productId);
  const currency = getCurrencyByCountry(selectedCountry);
  const promoPriceLocal = convertYen(promo.promoPriceYen, currency);
  const originalPriceLocal = convertYen(promo.originalPriceYen, currency);
  const typeLabel = PROMO_TYPES.find(t => t.value === promo.type)?.label ?? promo.type;
  const discount = promo.discountPct > 0 ? promo.discountPct : (promo.originalPriceYen > 0 ? Math.round((1 - promo.promoPriceYen / promo.originalPriceYen) * 100) : 0);

  const boughtKey = BOUGHT_KEY(promo.productId);
  const alreadyBought = parseInt(localStorage.getItem(boughtKey) || '0');
  const remaining = Math.max(0, promo.limitPerPerson - alreadyBought);

  const gallery: string[] = product?.gallery?.length ? product.gallery : [promo.productImage].filter(Boolean);

  const isExpired = promo.expiresAt ? promo.expiresAt < Date.now() : false;

  const promoQty = Math.min(qty, remaining);
  const overflowQty = Math.max(0, qty - remaining);
  const totalLocal = promoPriceLocal * promoQty + originalPriceLocal * overflowQty;

  const handleAddToCart = () => {
    if (isExpired) { toast({ title: 'Promoção encerrada', variant: 'destructive' }); return; }

    const baseProduct = product || {
      id: promo.productId, name: promo.productName, image: promo.productImage,
      thumbnail: promo.productImage, gallery: [promo.productImage],
      category: 'especial', description: '',
      prices: { small: originalPriceLocal },
    };

    // Adiciona unidades com preço promo (até o limite)
    if (promoQty > 0) {
      const promoItem = { ...baseProduct, id: promo.productId + '_promo', name: promo.productName + ' ✨', prices: { small: promoPriceLocal, large: promoPriceLocal } };
      addToCart(promoItem as any, 'small', promoQty);
      localStorage.setItem(boughtKey, String(alreadyBought + promoQty));
    }

    // Adiciona excedente com preço original
    if (overflowQty > 0 && product) {
      addToCart(product, 'small', overflowQty);
      toast({
        title: `✨ ${promoQty}x no preço promocional + ${overflowQty}x no preço original`,
        description: `O excedente ao limite (${promo.limitPerPerson}x/pessoa) foi adicionado com o preço normal.`,
      });
    } else if (promoQty > 0) {
      toast({ title: 'Adicionado ao carrinho! 🎉', description: `${promoQty}x ${promo.productName}` });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar para a loja
        </Link>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* Galeria */}
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden aspect-square bg-secondary border border-border">
              <img src={gallery[mainImg] || promo.productImage} alt={promo.productName} className="w-full h-full object-cover" />
              {discount > 0 && (
                <div className="absolute top-4 left-4 bg-red-500 text-white text-sm font-black px-3 py-1.5 rounded-full shadow">-{discount}%</div>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {gallery.map((img, i) => (
                  <button key={i} onClick={() => setMainImg(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${i === mainImg ? 'border-primary' : 'border-border'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 bg-yellow-400 text-gray-900 font-black text-sm uppercase px-3 py-1.5 rounded-full">
              <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
              {typeLabel}
            </div>

            <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground leading-tight">{promo.productName}</h1>

            {product?.description && <p className="text-muted-foreground leading-relaxed">{product.description}</p>}

            {/* Countdown */}
            {promo.expiresAt && countdown && (
              <div className={`flex items-center gap-2 text-sm font-semibold ${isExpired || countdown === 'Encerrada' ? 'text-red-600' : 'text-orange-600'}`}>
                <Clock className="w-4 h-4 shrink-0" />
                {countdown === 'Encerrada' ? 'Promoção encerrada' : `Encerra em: ${countdown}`}
              </div>
            )}

            {/* Preços */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground line-through">
                De: {formatPrice(originalPriceLocal, currency, true)} (¥{promo.originalPriceYen.toLocaleString()})
              </div>
              <div className="text-4xl font-black text-green-600">
                {formatPrice(promoPriceLocal, currency, true)}
                <span className="text-base font-normal text-muted-foreground ml-2">(¥{promo.promoPriceYen.toLocaleString()})</span>
              </div>
              {discount > 0 && (
                <div className="inline-block bg-red-100 text-red-700 text-sm font-bold px-3 py-1 rounded-full">
                  Economia de {formatPrice(originalPriceLocal - promoPriceLocal, currency, true)}
                </div>
              )}
            </div>

            {/* Limite por pessoa */}
            <div className={`flex items-start gap-2 text-sm p-3 rounded-lg border ${remaining > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {remaining > 0
                ? <><CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>Preço promocional para as primeiras <strong>{promo.limitPerPerson}</strong> unidade(s) por pessoa. O excedente entra no carrinho pelo preço original.</span></>
                : <><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>Você já atingiu o limite de {promo.limitPerPerson}x desta promoção. Você ainda pode comprar mais unidades pelo preço original.</span></>
              }
            </div>

            {/* Preview do pedido quando excede limite */}
            {overflowQty > 0 && !isExpired && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-orange-700"><Info className="w-4 h-4" /> Resumo do pedido</div>
                {promoQty > 0 && <div className="text-orange-700">{promoQty}x a {formatPrice(promoPriceLocal, currency, true)} <span className="text-xs">(preço promo)</span></div>}
                <div className="text-orange-700">{overflowQty}x a {formatPrice(originalPriceLocal, currency, true)} <span className="text-xs">(preço original)</span></div>
                <div className="font-bold text-orange-800 border-t border-orange-200 pt-1">Total: {formatPrice(totalLocal, currency, true)}</div>
              </div>
            )}

            {/* Seletor de quantidade */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Quantidade:</span>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-secondary transition-colors text-lg font-bold">−</button>
                <span className="px-4 py-2 font-semibold min-w-[3rem] text-center">{qty}</span>
                <button onClick={() => setQty(q => Math.min(99, q + 1))} className="px-3 py-2 hover:bg-secondary transition-colors text-lg font-bold">+</button>
              </div>
            </div>

            <Button size="lg" onClick={handleAddToCart} disabled={isExpired || countdown === 'Encerrada'} className="w-full gap-2 text-base font-bold">
              <ShoppingCart className="w-5 h-5" />
              {isExpired || countdown === 'Encerrada'
                ? 'Promoção encerrada'
                : `Adicionar ao carrinho — ${formatPrice(totalLocal, currency, true)}`}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              * Preço promocional válido apenas nesta página e limitado a {promo.limitPerPerson}x por pessoa. No catálogo o produto aparece com o preço original.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Promotion;
