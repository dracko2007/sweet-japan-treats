import React, { useState, useEffect } from 'react';
import { Sparkles, Tag, Trash2, Save, Search, Users, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/context/ProductsContext';
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ensureAdminAuth } from '@/utils/adminAuth';
import { useToast } from '@/hooks/use-toast';

export const PROMO_TYPES = [
  { value: 'abertura',   label: '🎉 Promoção de Abertura' },
  { value: 'mes',        label: '📅 Promoção do Mês' },
  { value: 'lancamento', label: '🚀 Promoção de Lançamento' },
  { value: 'temporada',  label: '🌸 Promoção de Temporada' },
  { value: 'relampago',  label: '⚡ Promoção Relâmpago' },
  { value: 'especial',   label: '⭐ Promoção Especial' },
  { value: 'exclusiva',  label: '💎 Exclusiva Online' },
  { value: 'frete',      label: '🚚 Frete Grátis' },
];

export interface ActivePromo {
  type: string;
  productId: string;
  productName: string;
  productImage: string;
  originalPrice: number;
  promoPrice: number;
  limitPerPerson: number;
}

const PromotionManager: React.FC = () => {
  const { products } = useProducts();
  const { toast } = useToast();
  const [active, setActive] = useState<ActivePromo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [selectedType, setSelectedType] = useState('abertura');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [promoPrice, setPromoPrice] = useState('');
  const [limitPerPerson, setLimitPerPerson] = useState('1');

  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, 'siteContent', 'homePromotion'))
      .then((snap) => { if (snap.exists()) setActive(snap.data() as ActivePromo); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Preenche preço original ao selecionar produto
  const selectProduct = (id: string) => {
    setSelectedProductId(id);
    const p = products.find((x) => x.id === id);
    if (p && !promoPrice) setPromoPrice(String(p.prices?.small || ''));
  };

  const save = async () => {
    if (!selectedProductId || !db) return;
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;
    const promoPriceNum = parseFloat(promoPrice.replace(',', '.'));
    if (!promoPriceNum || promoPriceNum <= 0) {
      toast({ title: 'Informe o preço da promoção', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await ensureAdminAuth();
      const promo: ActivePromo = {
        type: selectedType,
        productId: product.id,
        productName: product.name,
        productImage: product.thumbnail || product.image || '',
        originalPrice: product.prices?.small || 0,
        promoPrice: promoPriceNum,
        limitPerPerson: parseInt(limitPerPerson) || 1,
      };
      await setDoc(doc(db, 'siteContent', 'homePromotion'), promo);
      setActive(promo);
      toast({ title: 'Promoção ativada!', description: `${product.name} — R$ ${promoPriceNum.toFixed(2)}` });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!db) return;
    setSaving(true);
    try {
      await ensureAdminAuth();
      await deleteDoc(doc(db, 'siteContent', 'homePromotion'));
      setActive(null);
      toast({ title: 'Promoção removida da página inicial.' });
    } catch (e: any) {
      toast({ title: 'Erro ao remover', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground animate-pulse">Carregando...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Promoção na Página Inicial
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Banner no Hero → página dedicada com preço especial. O produto continua no catálogo com preço original.
        </p>
      </div>

      {/* Promoção ativa */}
      {active ? (
        <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/30 p-4 space-y-3">
          <div className="flex items-center gap-4">
            {active.productImage && (
              <img src={active.productImage} alt={active.productName} className="w-14 h-14 rounded-lg object-cover border border-border shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-green-600 uppercase tracking-wide mb-0.5">
                {PROMO_TYPES.find(t => t.value === active.type)?.label ?? active.type}
              </div>
              <div className="font-semibold text-foreground truncate">{active.productName}</div>
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className="text-muted-foreground line-through">R$ {active.originalPrice?.toFixed(2)}</span>
                <span className="font-bold text-green-700">R$ {active.promoPrice?.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">· máx. {active.limitPerPerson}x/pessoa</span>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={remove} disabled={saving} className="shrink-0 gap-1">
              <Trash2 className="w-4 h-4" /> Remover
            </Button>
          </div>
          <a href="/promocao" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
            Ver página da promoção →
          </a>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground text-center">
          Nenhuma promoção ativa na página inicial.
        </div>
      )}

      <div className="border border-border rounded-xl p-5 space-y-5">
        <h3 className="font-semibold text-foreground flex items-center gap-2"><Tag className="w-4 h-4" /> Nova promoção</h3>

        {/* Tipo */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Tipo de promoção</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {PROMO_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Busca de produto */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Produto em promoção</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Nenhum produto encontrado.</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-colors ${selectedProductId === p.id ? 'bg-primary/10' : ''}`}
                  >
                    {(p.thumbnail || p.image) && (
                      <img src={p.thumbnail || p.image} alt={p.name} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-border" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">R$ {(p.prices?.small || 0).toFixed(2)}</div>
                    </div>
                    {selectedProductId === p.id && <span className="text-xs text-primary font-semibold shrink-0">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preço e limite */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Preço da promoção (R$)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={selectedProduct ? String(selectedProduct.prices?.small || '') : '0.00'}
              value={promoPrice}
              onChange={(e) => setPromoPrice(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {selectedProduct && promoPrice && (
              <div className="text-xs text-green-600 font-medium">
                {Math.round((1 - parseFloat(promoPrice) / (selectedProduct.prices?.small || 1)) * 100)}% de desconto
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Limite por pessoa
            </label>
            <input
              type="number"
              min="1"
              max="99"
              value={limitPerPerson}
              onChange={(e) => setLimitPerPerson(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="text-xs text-muted-foreground">unidades máx. por compra</div>
          </div>
        </div>

        <Button onClick={save} disabled={!selectedProductId || !promoPrice || saving} className="w-full gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Ativar promoção na página inicial'}
        </Button>
      </div>
    </div>
  );
};

export default PromotionManager;
