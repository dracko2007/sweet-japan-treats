import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Link2, Copy, Check, DollarSign, Package, TrendingUp, Percent, Clock, X, Trophy, Users, ShoppingBag, Video } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import { useProducts } from '@/context/ProductsContext';
import { useToast } from '@/hooks/use-toast';
import { affiliateService, affiliateLink, isPromoter, SITE_URL, TIER_CONFIG } from '@/services/affiliateService';
import type { AffiliateDashboard, AffiliateReview, AffiliateTier } from '@/services/affiliateService';

const REVIEW_STATUS: Record<AffiliateReview['status'], { label: string; className: string }> = {
  pending: { label: 'Em análise', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Publicado no vlog', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Não aprovado', className: 'bg-gray-100 text-gray-600' },
};
const PLATFORM_LABEL: Record<AffiliateReview['platform'], string> = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };
import { convertYen as fxConvert, loadFxRates } from '@/services/fxService';

const AffiliatePage: React.FC = () => {
  const { user, isAuthenticated } = useUser();
  const { products } = useProducts();
  const [affiliates, setAffiliates] = useState<AffiliateDashboard[]>([]);
  const [pendingByCode, setPendingByCode] = useState<Record<string, { commissionYen: number; netYen: number; orders: number }>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [showTierModal, setShowTierModal] = useState(false);
  const { toast } = useToast();
  // Reviews (vídeos) que o divulgador enviou, e o link em digitação por código.
  const [reviews, setReviews] = useState<AffiliateReview[]>([]);
  const [reviewUrl, setReviewUrl] = useState<Record<string, string>>({});
  const [sendingReview, setSendingReview] = useState<string | null>(null);

  const sendReview = async (code: string) => {
    const url = (reviewUrl[code] || '').trim();
    if (!url) return;
    setSendingReview(code);
    const result = await affiliateService.submitReview(code, url);
    setSendingReview(null);
    if (result.ok === false) {
      toast({ title: 'Não foi possível enviar o vídeo', description: result.error, variant: 'destructive' });
      return;
    }
    setReviews((current) => [result.review, ...current]);
    setReviewUrl((current) => ({ ...current, [code]: '' }));
    toast({ title: 'Vídeo enviado', description: 'Assim que a loja aprovar, ele aparece no vlog do site.' });
  };
  useEffect(() => {
    loadFxRates().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    affiliateService.getByOwnerEmail(user.email).then(async (list) => {
      setAffiliates(list);
      if (list.some(isPromoter)) affiliateService.getMyReviews().then(setReviews);
      const map: Record<string, { commissionYen: number; netYen: number; orders: number }> = {};
      await Promise.all(
        list.filter((aff) => !isPromoter(aff)).map(async (aff) => {
          const pend = await affiliateService.getPendingByCode(aff.code);
          map[aff.code] = {
            commissionYen: pend.reduce((sum, p) => sum + (p.commissionYen || 0), 0),
            netYen: pend.reduce((sum, p) => sum + (p.netYen || 0), 0),
            orders: pend.length,
          };
        })
      );
      setPendingByCode(map);
      setLoading(false);
    });
  }, [user?.email]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const yen = (v: number) => `¥${(v || 0).toLocaleString()}`;
  // Divulgador: um código por produto/vídeo; ativos primeiro.
  const promoterCodes = affiliates
    .filter(isPromoter)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.code.localeCompare(b.code));
  const affiliateCodes = affiliates.filter((aff) => !isPromoter(aff));
  const onlyPromoter = promoterCodes.length > 0 && affiliateCodes.length === 0;
  const brl = (v: number) => `R$ ${fxConvert(v || 0, 'BRL').toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-semibold text-sm px-4 py-1.5 rounded-full mb-4">
            <Megaphone className="w-4 h-4" /> {onlyPromoter ? 'Programa de Divulgadores' : 'Programa de Afiliados'}
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-3">
            {onlyPromoter ? 'Painel do Divulgador' : 'Painel do Influencer'}
          </h1>
          <p className="text-muted-foreground text-lg">
            {onlyPromoter ? 'Seus códigos, links e o retorno de cada divulgação' : 'Acompanhe suas indicações e comissões'}
          </p>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          {!isAuthenticated ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-6">Entre na sua conta para ver seu painel de afiliado.</p>
              <Button asChild className="btn-primary"><Link to="/login">Entrar</Link></Button>
            </div>
          ) : loading ? (
            <div className="text-center py-16 text-muted-foreground">Carregando...</div>
          ) : affiliates.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Você ainda não é afiliado</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                O programa de afiliados é por convite. Entre em contato com a loja para se tornar um
                influencer parceiro e ganhar comissão divulgando seu código.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {promoterCodes.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold">Seus códigos de divulgação</h2>
                    <p className="text-sm text-muted-foreground">
                      Cada produto que você recebe tem um código e um link próprios. Use o link ou o código do produto
                      certo em cada vídeo: é assim que contamos quem veio por você.
                    </p>
                  </div>
                  {promoterCodes.map((aff) => {
                    const link = affiliateLink(aff.code, aff.productId);
                    const expired = new Date(aff.expiresAt) < new Date();
                    const visits = aff.visitCount || 0;
                    const buyers = aff.totalOrders || 0;
                    return (
                      <div key={aff.code} className={`bg-card rounded-2xl border border-border p-6 lg:p-8 space-y-5 ${!aff.active || expired ? 'opacity-70' : ''}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase font-bold text-muted-foreground">Produto</p>
                            <p className="font-display text-xl font-bold">
                              {aff.productName || products.find((p) => p.id === aff.productId)?.name || 'Produto da divulgação'}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${aff.active && !expired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {expired ? 'Expirado' : aff.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-secondary/30 rounded-xl p-4">
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Users className="w-3 h-3" /> Pessoas que vieram</p>
                            <p className="text-2xl font-bold">{visits}</p>
                            <p className="text-[10px] text-muted-foreground">{aff.linkVisits || 0} pelo link · {aff.codeVisits || 0} pelo código</p>
                          </div>
                          <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
                            <p className="text-xs text-primary flex items-center gap-1 mb-1"><ShoppingBag className="w-3 h-3" /> Compraram</p>
                            <p className="text-2xl font-bold text-primary">{buyers}</p>
                            <p className="text-[10px] text-muted-foreground">pedidos pagos com seu link ou código</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs uppercase font-bold text-muted-foreground mb-2">Seu código</p>
                          <div className="flex gap-2">
                            <input
                              readOnly
                              aria-label={`Código ${aff.code}`}
                              value={aff.code}
                              className="flex-1 min-w-0 px-3 py-2 text-lg rounded-lg border border-border bg-secondary/30 font-mono font-extrabold text-primary"
                              onFocus={(e) => e.currentTarget.select()}
                            />
                            <Button variant="outline" onClick={() => copy(aff.code, `code-${aff.code}`)} className="px-3" aria-label="Copiar código">
                              {copied === `code-${aff.code}` ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs uppercase font-bold text-muted-foreground mb-2 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Link deste produto</p>
                          <div className="flex gap-2">
                            <input
                              readOnly
                              aria-label={`Link do código ${aff.code}`}
                              value={link}
                              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-border bg-secondary/30 font-mono"
                              onFocus={(e) => e.currentTarget.select()}
                            />
                            <Button variant="outline" onClick={() => copy(link, `link-${aff.code}`)} className="px-3" aria-label="Copiar link">
                              {copied === `link-${aff.code}` ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-2">
                            Coloque este link na descrição do vídeo ou divulgue o código <strong>{aff.code}</strong>.
                            {aff.discountPercent > 0 ? ` Quem usar ganha ${aff.discountPercent}% de desconto.` : ''}
                            {' '}Cada cliente pode usar este código uma única vez.
                          </p>
                        </div>

                        {/* Vídeo de review: o divulgador cola o link e ele vai para o vlog do site */}
                        <div className="border-t border-border pt-5">
                          <p className="text-xs uppercase font-bold text-muted-foreground mb-2 flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Seu vídeo de review</p>
                          <form
                            className="flex gap-2"
                            onSubmit={(e) => { e.preventDefault(); void sendReview(aff.code); }}
                          >
                            <input
                              type="url"
                              inputMode="url"
                              aria-label={`Link do vídeo de review do código ${aff.code}`}
                              value={reviewUrl[aff.code] || ''}
                              onChange={(e) => setReviewUrl((current) => ({ ...current, [aff.code]: e.target.value }))}
                              placeholder="Cole o link do YouTube, TikTok ou Instagram"
                              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-border bg-background"
                            />
                            <Button type="submit" className="btn-primary shrink-0" disabled={sendingReview === aff.code || !(reviewUrl[aff.code] || '').trim()}>
                              {sendingReview === aff.code ? 'Enviando...' : 'Enviar'}
                            </Button>
                          </form>
                          <p className="text-[11px] text-muted-foreground mt-2">
                            Depois de aprovado pela loja, o vídeo aparece no vlog do site com o link deste produto.
                          </p>
                          {reviews.filter((review) => review.code === aff.code).length > 0 && (
                            <ul className="mt-3 space-y-2">
                              {reviews.filter((review) => review.code === aff.code).map((review) => (
                                <li key={review.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-2">
                                  <a href={review.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-sm font-medium text-foreground hover:text-primary">
                                    <span className="block truncate">{review.title || review.url}</span>
                                    <span className="text-[11px] text-muted-foreground">{PLATFORM_LABEL[review.platform]}</span>
                                  </a>
                                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${REVIEW_STATUS[review.status].className}`}>
                                    {REVIEW_STATUS[review.status].label}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {affiliateCodes.map((aff) => {
                const link = `${SITE_URL}/?ref=${aff.code}`;
                const expired = new Date(aff.expiresAt) < new Date();
                const pend = pendingByCode[aff.code] || { commissionYen: 0, netYen: 0, orders: 0 };
                const totalVendas = (aff.totalOrders || 0) + pend.orders;
                const totalReceita = (aff.totalRevenue || 0) + pend.netYen;
                return (
                  <div key={aff.code} className="bg-card rounded-2xl border border-border p-6 lg:p-8 space-y-6">
                    {/* Header com código */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase font-bold text-muted-foreground">Seu código</p>
                        <p className="font-display text-3xl font-extrabold text-primary font-mono">{aff.code}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTierModal(true)}
                          className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                        >
                          <Trophy className="w-4 h-4" />
                          Metas do Afiliado
                        </Button>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${aff.active && !expired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {expired ? 'Expirado' : aff.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-secondary/30 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Percent className="w-3 h-3" /> Desconto</p>
                        <p className="text-xl font-bold">{aff.discountPercent}%</p>
                        <p className="text-[10px] text-muted-foreground">para quem usa</p>
                      </div>
                      <div className="bg-secondary/30 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Package className="w-3 h-3" /> Vendas</p>
                        <p className="text-xl font-bold">{totalVendas}</p>
                        {pend.orders > 0 && (
                          <p className="text-[10px] text-amber-600">{pend.orders} aguardando entrega</p>
                        )}
                      </div>
                      <div className="bg-secondary/30 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><TrendingUp className="w-3 h-3" /> Receita gerada</p>
                        <p className="text-xl font-bold">{yen(totalReceita)}</p>
                        <p className="text-xs font-semibold text-muted-foreground">{brl(totalReceita)}</p>
                        {pend.netYen > 0 && (
                          <p className="text-[10px] text-amber-600">{yen(pend.netYen)} · {brl(pend.netYen)} pendente</p>
                        )}
                      </div>
                      <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
                        <p className="text-xs text-primary flex items-center gap-1 mb-1"><DollarSign className="w-3 h-3" /> Comissão liberada</p>
                        <p className="text-xl font-bold text-primary">{yen(aff.totalEarnings)}</p>
                        <p className="text-xs font-semibold text-primary/80">{brl(aff.totalEarnings)}</p>
                        <p className="text-[10px] text-muted-foreground">{aff.commissionPercent}% das vendas</p>
                        {/* Badge de nível */}
                        {(() => {
                          const tier: AffiliateTier = aff.tier || 'bronze';
                          const cfg = TIER_CONFIG[tier];
                          const monthRev = aff.currentMonthRevenue || 0;
                          const progress = Math.min(100, Math.round((monthRev / cfg.goalYen) * 100));
                          const nextCfg = cfg.nextTier ? TIER_CONFIG[cfg.nextTier] : null;
                          return (
                            <div className="mt-2 space-y-1.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                tier === 'gold'   ? 'bg-yellow-100 text-yellow-700' :
                                tier === 'silver' ? 'bg-gray-100 text-gray-600' :
                                                    'bg-pink-100 text-pink-700'
                              }`}>{cfg.emoji} {cfg.label}</span>
                              <div>
                                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                                  <span>Este mês: {yen(monthRev)} · {brl(monthRev)}</span>
                                  <span>Meta: {yen(cfg.goalYen)} · {brl(cfg.goalYen)}</span>
                                </div>
                                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : progress >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                                    style={{ width: `${progress}%` }} />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {progress >= 100
                                    ? `✅ Meta batida!${nextCfg ? ` → ${nextCfg.emoji} ${nextCfg.label} no próximo mês` : ''}`
                                    : `Faltam ¥${(cfg.goalYen - monthRev).toLocaleString()} para ${nextCfg ? `subir para ${nextCfg.emoji} ${nextCfg.label}` : 'manter Ouro'}`}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                        {pend.commissionYen > 0 && (
                          <div className="mt-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 border border-amber-200 dark:border-amber-800">
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1 font-semibold">
                              <Clock className="w-3 h-3" /> {yen(pend.commissionYen)} · {brl(pend.commissionYen)} a liberar
                            </p>
                            <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80">
                              Liberado após confirmação de entrega
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Link de indicação */}
                    <div>
                      <p className="text-xs uppercase font-bold text-muted-foreground mb-2 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Seu link de indicação</p>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={link}
                          className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-secondary/30 font-mono"
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <Button variant="outline" onClick={() => copy(link, `link-${aff.code}`)} className="px-3">
                          {copied === `link-${aff.code}` ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Compartilhe este link ou divulgue o código <strong>{aff.code}</strong>. Quem comprar usando ele
                        ganha {aff.discountPercent}% de desconto, e você recebe {aff.commissionPercent}% do valor líquido.
                      </p>
                    </div>

                    {/* Gerador de link de um produto específico */}
                    <div className="border-t border-border pt-5">
                      <p className="text-xs uppercase font-bold text-muted-foreground mb-2 flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" /> Link de um produto específico
                      </p>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background mb-2"
                      >
                        <option value="">Escolha um produto para gerar o link...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      {selectedProductId && (
                        <div className="flex gap-2">
                          <input
                            readOnly
                            value={`${SITE_URL}/produto/${selectedProductId}?ref=${aff.code}`}
                            className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-secondary/30 font-mono"
                            onFocus={(e) => e.currentTarget.select()}
                          />
                          <Button
                            variant="outline"
                            onClick={() => copy(`${SITE_URL}/produto/${selectedProductId}?ref=${aff.code}`, `prod-${aff.code}`)}
                            className="px-3"
                          >
                            {copied === `prod-${aff.code}` ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Gere o link de qualquer produto. Quem abrir já entra com o seu código aplicado e vai direto pro produto.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Modal Metas do Afiliado */}
      {showTierModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowTierModal(false)}>
          <div className="bg-card rounded-2xl w-full max-w-lg shadow-2xl border border-border overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-yellow-400 p-5 text-white relative">
              <button onClick={() => setShowTierModal(false)} className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <Trophy className="w-7 h-7" />
                <div>
                  <h2 className="font-bold text-xl">Sistema de Metas</h2>
                  <p className="text-yellow-100 text-sm">Venda mais e aumente sua comissão</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">


              {/* Como funciona */}
              <div className="bg-secondary/40 rounded-xl p-4 text-sm space-y-2">
                <p className="font-semibold text-base">Como funciona?</p>
                <p className="text-muted-foreground">O ciclo de vendas fecha no último dia do mês e reinicia automaticamente no dia 1º. O nível do mês anterior define a comissão do novo mês:</p>
                <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Se atingir a meta do seu nível, você mantém esse nível no mês seguinte.</li>
                  <li>Se não atingir a meta, desce para o nível correspondente ao lucro obtido.</li>
                  <li>A nova porcentagem vale para cada venda confirmada durante o novo mês.</li>
                  <li>As metas consideram somente o lucro líquido dos produtos, sem frete e taxa do Personal Shopper.</li>
                </ul>
              </div>

              {/* Tabela de níveis */}
              <div className="space-y-3">
                <p className="font-semibold text-sm">Níveis e metas:</p>
                {(Object.entries(TIER_CONFIG) as [AffiliateTier, typeof TIER_CONFIG[AffiliateTier]][]).map(([key, cfg]) => (
                  <div key={key} className={`rounded-xl border-2 p-4 ${
                    key === 'gold'   ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20' :
                    key === 'silver' ? 'border-gray-300 bg-gray-50 dark:bg-gray-900/30' :
                                       'border-pink-200 bg-pink-50 dark:bg-pink-950/20'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{cfg.emoji}</span>
                        <div>
                          <p className="font-bold">{cfg.label}</p>
                          <p className="text-xs text-muted-foreground">Comissão: <strong>{cfg.commissionPercent}%</strong> de cada venda</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Meta mensal</p>
                        <p className="font-bold text-lg">¥{cfg.goalYen.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {key === 'bronze' && <>
                        <p>✅ Até ¥100k → mantém Bronze; acima disso sobe conforme a próxima meta.</p>
                        <p>🥉 Nível inicial — não cai abaixo daqui.</p>
                      </>}
                      {key === 'silver' && <>
                        <p>✅ Acima de ¥200k → sobe para 🥇 <strong>Ouro (20%)</strong></p>
                        <p>⚠️ Até ¥100k → cai para 🥉 <strong>Bronze (10%)</strong></p>
                      </>}
                      {key === 'gold' && <>
                        <p>✅ Acima de ¥200k → mantém 🥇 <strong>Ouro (20%)</strong></p>
                        <p>⚠️ Até ¥200k → retorna ao nível correspondente no próximo ciclo</p>
                      </>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-sm space-y-2">
                <p className="font-semibold">Exemplos práticos:</p>
                <p className="text-muted-foreground">Se no mês anterior você estava no Bronze e lucrou ¥100.000, atingiu a meta e continua no Bronze; cada venda do novo mês gera 10% de comissão.</p>
                <p className="text-muted-foreground">Se estava no Bronze e lucrou ¥150.000, ultrapassou ¥100.000 e começa o novo mês no Prata; cada venda confirmada passa a gerar 15%.</p>
                <p className="text-muted-foreground">Se estava no Prata e lucrou ¥180.000, não atingiu ¥200.000; cai para Prata conforme a faixa alcançada. Se lucrou ¥80.000, cai para Bronze e recebe 10% nas vendas do novo mês.</p>
                <p className="text-muted-foreground">Se estava no Ouro e lucrou ¥250.000, mantém Ouro e recebe 20% sobre cada venda confirmada do novo mês. Se lucrou ¥150.000, começa o novo mês no Prata e recebe 15%.</p>
                <p className="text-muted-foreground">O valor da comissão é calculado sobre o lucro líquido de cada venda, sem frete e taxa do Personal Shopper.</p>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                A comissão é calculada sobre o valor líquido de cada venda e liberada após confirmação de entrega.
              </p>

            </div>

            <div className="p-4 border-t border-border">
              <Button onClick={() => setShowTierModal(false)} className="w-full btn-primary">Entendido!</Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AffiliatePage;
