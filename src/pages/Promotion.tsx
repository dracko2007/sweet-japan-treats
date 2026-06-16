import React, { useEffect, useState } from 'react';
import { ShoppingCart, Sparkles, ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useProducts } from '@/context/ProductsContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { formatPrice } from '@/utils/currency';
import { useLanguage } from '@/context/LanguageContext';
import { ActivePromo, PROMO_TYPES } from '@/components/admin/PromotionManager';

const STORAGE_KEY = (productId: string) => `promo_bought_${productId}`;

const Promotion: React.FC = () => {
  const [promo, setPromo] = useState<ActivePromo | null | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const { addToCart } = useCart();
  const { products } = useProducts();
  const { toast } = useToast();
  const { selectedCountry } = useLanguage();

  useEffect(() => {
    if (!db) { setPromo(null); return; }
    getDoc(doc(db, 'siteContent', 'homePromotion'))
      .then((snap) => setPromo(snap.exists() ? (snap.data() as ActivePromo) : null))
      .catch(() => setPromo(null));
  }, []);

  if (promo === undefined) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 flex justify-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!promo) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 text-center space-y-4">
          <Sparkles className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Nenhuma promoção ativa no momento.</h1>
          <p className="text-muted-foreground">Volte em breve para ofertas exclusivas!</p>
          <Button asChild variant="outline"><Link to="/produtos"><ArrowLeft className="w-4 h-4 mr-2" />Ver produtos</Link></Button>
        </div>
      </Layout>
    );
  }

  const product = products.find((p) => p.id === promo.productId);
  const typeLabel = PROMO_TYPES.find(t => t.value === promo.type)?.label ?? promo.type;
  const boughtKey = STORAGE_KEY(promo.productId);
  const alreadyBought = parseInt(localStorage.getItem(boughtKey) || '0');
  const remaining = Math.max(0, promo.limitPerPerson - alreadyBought);
  const maxQty = Math.min(remaining, 10);
  const discount = promo.originalPrice > 0
    ? Math.round((1 - promo.promoPrice / promo.originalPrice) * 100)
    : 0;

  const gallery: string[] = product?.gallery?.length
    ? product.gallery
    : [promo.productImage].filter(Boolean);

  const handleAddToCart = () => {
    if (remaining <= 0) {
      toast({ title: 'Limite atingido', description: `Você já comprou o máximo permitido desta promoção (${promo.limitPerPerson}x).`, variant: 'destructive' });
      return;
    }
    if (qty > remaining) {
      toast({ title: 'Quantidade excede o limite', description: `Você pode comprar no máximo mais ${remaining} unidade(s).`, variant: 'destructive' });
      return;
    }

    const promoProduct = {
      ...(product || {
        id: promo.productId,
        name: promo.productName,
        image: promo.productImage,
        thumbnail: promo.productImage,
        gallery: [promo.productImage],
        category: 'especial',
        description: '',
        prices: { small: promo.promoPrice },
      }),
      prices: { small: promo.promoPrice, large: promo.promoPrice },
      _promoLabel: typeLabel,
    };

    addToCart(promoProduct as any, qty, 'small');
    localStorage.setItem(boughtKey, String(alreadyBought + qty));
    toast({
      title: 'Adicionado ao carrinho! 🎉',
      description: `${qty}x ${promo.productName} — R$ ${(promo.promoPrice * qty).toFixed(2)}`,
    });
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
              <img
                src={gallery[0] || promo.productImage}
                alt={promo.productName}
                className="w-full h-full object-cover"
              />
              {discount > 0 && (
                <div className="absolute top-4 left-4 bg-red-500 text-white text-sm font-black px-3 py-1.5 rounded-full shadow">
                  -{discount}%
                </div>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {gallery.slice(1).map((img, i) => (
                  <img key={i} src={img} alt="" className="w-16 h-16 rounded-lg object-cover border border-border shrink-0" />
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-5">
            {/* Badge promoção */}
            <div className="inline-flex items-center gap-2 bg-yellow-400 text-gray-900 font-black text-sm uppercase px-3 py-1.5 rounded-full">
              <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
              {typeLabel}
            </div>

            <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground leading-tight">
              {promo.productName}
            </h1>

            {product?.description && (
              <p className="text-muted-foreground leading-relaxed">{product.description}</p>
            )}

            {/* Preços */}
            <div className="flex items-end gap-4">
              <div>
                <div className="text-sm text-muted-foreground line-through">
                  De: R$ {promo.originalPrice.toFixed(2)}
                </div>
                <div className="text-4xl font-black text-green-600">
                  R$ {promo.promoPrice.toFixed(2)}
                </div>
              </div>
              {discount > 0 && (
                <div className="mb-1 bg-red-100 text-red-700 text-sm font-bold px-3 py-1 rounded-full">
                  Economia de R$ {(promo.originalPrice - promo.promoPrice).toFixed(2)}
                </div>
              )}
            </div>

            {/* Limite */}
            <div className={`flex items-center gap-2 text-sm font-medium ${remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {remaining > 0
                ? <><CheckCircle className="w-4 h-4" /> Você pode comprar até {promo.limitPerPerson} unidade(s) por pessoa</>
                : <><AlertTriangle className="w-4 h-4" /> Você atingiu o limite desta promoção</>
              }
            </div>

            {/* Quantidade */}
            {remaining > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">Quantidade:</span>
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-secondary transition-colors text-lg font-bold">−</button>
                  <span className="px-4 py-2 font-semibold min-w-[3rem] text-center">{qty}</span>
                  <button onClick={() => setQty(q => Math.min(maxQty, q + 1))} className="px-3 py-2 hover:bg-secondary transition-colors text-lg font-bold">+</button>
                </div>
                {maxQty < 10 && <span className="text-xs text-muted-foreground">máx. {maxQty}</span>}
              </div>
            )}

            <Button
              size="lg"
              onClick={handleAddToCart}
              disabled={remaining <= 0}
              className="w-full gap-2 text-base font-bold"
            >
              <ShoppingCart className="w-5 h-5" />
              {remaining > 0 ? `Adicionar ao carrinho — R$ ${(promo.promoPrice * qty).toFixed(2)}` : 'Limite atingido'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              * Preço promocional válido apenas nesta página. No catálogo o produto aparece com preço original.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Promotion;
