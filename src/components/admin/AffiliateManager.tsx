import React, { useEffect, useRef, useState } from 'react';
import { Megaphone, Plus, Trash2, Link2, TrendingUp, DollarSign, Package, X, CheckCircle, Clock, RefreshCw, Users, ShoppingBag, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { affiliateService, affiliateLink, isPromoter, Affiliate, AffiliateKind, AffiliateReview, PendingCommission, TIER_CONFIG, AffiliateTier } from '@/services/affiliateService';
import { useProducts } from '@/context/ProductsContext';

const EMPTY_FORM = {
  kind: 'affiliate' as AffiliateKind,
  productId: '',
  code: '',
  ownerName: '',
  ownerEmail: '',
  discountPercent: 10,
  commissionPercent: 10,
  validityDays: 90,
  active: true,
  bronzeGoalYen: 100000,
  bronzePercent: 10,
  silverGoalYen: 200000,
  silverPercent: 15,
  goldGoalYen: 201000,
  goldPercent: 20,
};

type AffiliateForm = typeof EMPTY_FORM;

const AffiliateManager: React.FC = () => {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { products } = useProducts();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [pending, setPending] = useState<PendingCommission[]>([]);
  const [reviews, setReviews] = useState<AffiliateReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<AffiliateForm>(EMPTY_FORM);
  // Dono do código extra (só para o título do formulário).
  const [extraCodeFor, setExtraCodeFor] = useState<string | null>(null);
  // O formulário fica no topo e os botões Editar/+ Código ficam na lista, lá embaixo:
  // ao abrir, rola até ele (senão parece que o clique não fez nada).
  const formRef = useRef<HTMLDivElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [formOpenKey, setFormOpenKey] = useState(0);
  useEffect(() => {
    if (!formOpenKey) return;
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!editingCode) codeInputRef.current?.focus({ preventScroll: true });
  }, [formOpenKey, editingCode]);

  const openForm = (next: AffiliateForm, code: string | null, extraFor: string | null) => {
    setForm(next);
    setEditingCode(code);
    setExtraCodeFor(extraFor);
    setCreating(true);
    setFormOpenKey((k) => k + 1);
  };
  const closeForm = () => {
    setCreating(false);
    setEditingCode(null);
    setExtraCodeFor(null);
    setForm(EMPTY_FORM);
  };

  const load = async () => {
    setLoading(true);
    const [list, pend, revs] = await Promise.all([
      affiliateService.getAll(),
      affiliateService.getPendingCommissions(),
      affiliateService.getAllReviews(),
    ]);
    setReviews(revs);
    setAffiliates(list.sort((a, b) => b.totalEarnings - a.totalEarnings));
    setPending(pend.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const [evaluating, setEvaluating] = useState(false);
  const handleEvaluateTiers = async () => {
    await confirm({
      title: 'Avaliar níveis dos afiliados?',
      description: 'Processa as vendas do mês atual e atualiza os níveis conforme as metas.',
      confirmLabel: 'Avaliar agora',
      onConfirm: async () => {
        setEvaluating(true);
        try {
          const res = await affiliateService.evaluateAllTiers();
          toast({
            title: '🏆 Níveis atualizados',
            description: `${res.updated} afiliado(s) processado(s)${res.errors ? ` · ${res.errors} erro(s)` : ''}`,
          });
          load();
        } finally {
          setEvaluating(false);
        }
      },
    });
  };

  const handleResetAllAffiliates = async () => {
    await confirm({
      title: 'Resetar todos os afiliados?',
      details: [
        'Apaga o nível e as vendas do mês atual de todos, retornando-os ao Bronze.',
        'O histórico total de vendas e ganhos é preservado.',
      ],
      destructive: true,
      password: true,
      permission: 'financial',
      confirmLabel: 'Resetar afiliados',
      onConfirm: async () => {
        setEvaluating(true);
        try {
          const res = await affiliateService.resetAllAffiliates();
          toast({
            title: 'Afiliados resetados',
            description: `${res.updated} afiliado(s) retornaram ao Bronze${res.errors ? ` · ${res.errors} erro(s)` : ''}`,
          });
          load();
        } finally {
          setEvaluating(false);
        }
      },
    });
  };

  const handleConfirm = async (pc: PendingCommission) => {
    await confirm({
      title: `Liberar comissão de ${pc.affiliateCode}?`,
      details: [`Valor da comissão: ¥${pc.commissionYen.toLocaleString()}`],
      confirmLabel: 'Liberar comissão',
      onConfirm: async () => {
        if (!(await affiliateService.confirmPendingCommission(pc.id))) throw new Error('Erro ao confirmar comissão.');
        toast({ title: '✅ Comissão liberada', description: `${pc.affiliateCode} · ¥${pc.commissionYen.toLocaleString()}` });
        load();
      },
    });
  };

  const handleCancelPending = async (pc: PendingCommission) => {
    await confirm({
      title: `Cancelar comissão de ${pc.affiliateCode}?`,
      details: ['A comissão pendente deste pedido será cancelada.'],
      destructive: true,
      confirmLabel: 'Cancelar comissão',
      onConfirm: async () => {
        if (!(await affiliateService.cancelPendingCommission(pc.id))) throw new Error('Não foi possível cancelar a comissão.');
        toast({ title: 'Comissão cancelada' });
        load();
      },
    });
  };

  const handleReview = async (review: AffiliateReview, status: 'approved' | 'rejected' | 'deleted') => {
    if (!(await affiliateService.moderateReview(review.id, status))) {
      toast({ title: 'Não foi possível atualizar o vídeo', variant: 'destructive' });
      return;
    }
    toast({ title: status === 'approved' ? '✅ Vídeo publicado no vlog' : status === 'rejected' ? 'Vídeo recusado' : 'Vídeo removido' });
    setReviews((current) => status === 'deleted'
      ? current.filter((item) => item.id !== review.id)
      : current.map((item) => (item.id === review.id ? { ...item, status } : item)));
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.ownerEmail.trim()) {
      toast({ title: 'Informe o código e o e-mail do influencer', variant: 'destructive' });
      return;
    }
    const newCode = form.code.trim().toUpperCase();
    const promoter = form.kind === 'promoter';
    if (promoter && !form.productId) {
      toast({ title: 'Escolha o produto enviado ao divulgador', description: 'O link do código leva direto a esse produto.', variant: 'destructive' });
      return;
    }
    if (!editingCode && affiliates.some((a) => a.code.toUpperCase() === newCode)) {
      toast({ title: `O código ${newCode} já existe`, description: 'Escolha outro código ou use Editar na lista.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const ok = await affiliateService.save({
      code: form.code.toUpperCase(),
      kind: form.kind,
      ownerName: form.ownerName.trim() || form.code.toUpperCase(),
      ownerEmail: form.ownerEmail.trim(),
      discountPercent: Number(form.discountPercent),
      ...(promoter
        ? {
            commissionPercent: 0,
            productId: form.productId,
            productName: products.find((p) => p.id === form.productId)?.name || '',
          }
        : {
            commissionPercent: Number(form.bronzePercent),
            tierSettings: {
              bronzeGoalYen: Number(form.bronzeGoalYen), bronzePercent: Number(form.bronzePercent),
              silverGoalYen: Number(form.silverGoalYen), silverPercent: Number(form.silverPercent),
              goldGoalYen: Number(form.goldGoalYen), goldPercent: Number(form.goldPercent),
            },
          }),
      active: form.active,
      expiresAt: new Date(Date.now() + form.validityDays * 86400000).toISOString(),
    });
    setSaving(false);
    if (ok) {
      toast({
        title: editingCode ? '✅ Cadastro atualizado' : '✅ Código criado',
        description: promoter ? affiliateLink(newCode, form.productId) : newCode,
      });
      closeForm();
      load();
    } else {
      toast({ title: 'Erro ao salvar afiliado', variant: 'destructive' });
    }
  };

  const handleDelete = async (code: string) => {
    await confirm({
      title: `Excluir o afiliado ${code}?`,
      details: ['O código de afiliado e as configurações deste afiliado serão removidos.'],
      destructive: true,
      permission: 'delete',
      onConfirm: async () => {
        const res = await affiliateService.remove(code);
        if (!res.ok) throw new Error(res.error || 'Não foi possível remover o afiliado.');
        toast({ title: '🗑️ Afiliado removido', description: code });
        load();
      },
    });
  };
  const startEdit = (affiliate: Affiliate) => {
    const settings = affiliate.tierSettings;
    openForm({
      kind: isPromoter(affiliate) ? 'promoter' : 'affiliate',
      productId: affiliate.productId || '',
      code: affiliate.code,
      ownerName: affiliate.ownerName,
      ownerEmail: affiliate.ownerEmail,
      discountPercent: affiliate.discountPercent,
      commissionPercent: affiliate.commissionPercent,
      validityDays: Math.max(1, Math.ceil((new Date(affiliate.expiresAt).getTime() - Date.now()) / 86400000) || 1),
      active: affiliate.active,
      bronzeGoalYen: settings?.bronzeGoalYen || 100000,
      bronzePercent: settings?.bronzePercent || 10,
      silverGoalYen: settings?.silverGoalYen || 200000,
      silverPercent: settings?.silverPercent || 15,
      goldGoalYen: settings?.goldGoalYen || 201000,
      goldPercent: settings?.goldPercent || 20,
    }, affiliate.code, null);
  };
  const startAdditionalCode = (affiliate: Affiliate) => {
    const settings = affiliate.tierSettings;
    openForm({
      // Divulgador: código novo = produto/vídeo novo, então o produto começa vazio.
      kind: isPromoter(affiliate) ? 'promoter' : 'affiliate',
      productId: '',
      code: '',
      ownerName: affiliate.ownerName,
      ownerEmail: affiliate.ownerEmail,
      discountPercent: affiliate.discountPercent,
      commissionPercent: affiliate.commissionPercent,
      validityDays: 365,
      active: true,
      bronzeGoalYen: settings?.bronzeGoalYen || 100000,
      bronzePercent: settings?.bronzePercent || 10,
      silverGoalYen: settings?.silverGoalYen || 200000,
      silverPercent: settings?.silverPercent || 15,
      goldGoalYen: settings?.goldGoalYen || 201000,
      goldPercent: settings?.goldPercent || 20,
    }, null, affiliate.ownerName || affiliate.code);
  };

  const copyLink = (aff: Affiliate) => {
    const link = affiliateLink(aff.code, isPromoter(aff) ? aff.productId : undefined);
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado', description: link });
  };

  const yen = (v: number) => `¥${(v || 0).toLocaleString()}`;
  const isPromoterForm = form.kind === 'promoter';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold">Afiliados / Influencers</h2>
            <p className="text-sm text-muted-foreground">
              Afiliado: comissão por venda com metas · Divulgador: recebe o produto e você mede o retorno de cada código
            </p>
          </div>
        </div>
        <Button onClick={() => (creating ? closeForm() : openForm(EMPTY_FORM, null, null))} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Novo Afiliado
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-primary/20 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Níveis de comissão dos afiliados</h3>
            <p className="text-xs text-muted-foreground">
              A meta é acumulada no mês corrente e reiniciada no primeiro dia do mês seguinte.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleResetAllAffiliates} disabled={evaluating} className="gap-2 text-destructive border-destructive/30">
              Resetar todos
            </Button>
            <Button variant="outline" size="sm" onClick={handleEvaluateTiers} disabled={evaluating} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${evaluating ? 'animate-spin' : ''}`} />
              {evaluating ? 'Avaliando...' : 'Atualizar níveis'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.entries(TIER_CONFIG) as [AffiliateTier, typeof TIER_CONFIG[AffiliateTier]][]).map(([key, cfg]) => (
            <div key={key} className={`rounded-lg border p-4 ${
              key === 'gold' ? 'border-yellow-300 bg-yellow-50/60 dark:bg-yellow-950/20' :
              key === 'silver' ? 'border-gray-300 bg-gray-50 dark:bg-gray-900/30' :
              'border-pink-200 bg-pink-50 dark:bg-pink-950/20'
            }`}>
              <div className="flex items-center justify-between">
                <strong>{cfg.emoji} {cfg.label}</strong>
                <span className="font-bold text-primary">{cfg.commissionPercent}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Meta mensal: <strong className="text-foreground">¥{cfg.goalYen.toLocaleString()}</strong>
              </p>
            </div>
          ))}
        </div>
      </div>

      {creating && (
        <div ref={formRef} className="bg-card rounded-xl border-2 border-primary/40 p-6 scroll-mt-40">
          <h3 className="font-semibold mb-4">
            {editingCode ? `Editar ${isPromoterForm ? 'divulgador' : 'afiliado'} ${editingCode}` : extraCodeFor ? `Novo código para ${extraCodeFor}` : 'Cadastrar Influencer'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="affiliate-kind">Tipo de parceria *</Label>
              <select
                id="affiliate-kind"
                value={form.kind}
                onChange={(e) => setForm({
                  ...form,
                  kind: e.target.value as AffiliateKind,
                  // Divulgador normalmente só rastreia; afiliado volta ao desconto padrão.
                  discountPercent: e.target.value === 'promoter' ? 0 : (form.discountPercent || EMPTY_FORM.discountPercent),
                })}
                className="w-full h-10 px-3 text-sm rounded-md border border-input bg-background"
              >
                <option value="affiliate">Afiliado — comissão por venda, com metas</option>
                <option value="promoter">Divulgador — recebe o produto grátis e divulga</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                {isPromoterForm
                  ? 'Sem comissão nem meta. Cada código é de um produto/vídeo e conta quantas pessoas vieram e quantas compraram.'
                  : 'Ganha comissão sobre o lucro de cada venda, conforme as metas mensais.'}
              </p>
            </div>
            {isPromoterForm && (
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="affiliate-product">Produto enviado *</Label>
                <select
                  id="affiliate-product"
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  className="w-full h-10 px-3 text-sm rounded-md border border-input bg-background"
                >
                  <option value="">Escolha o produto deste código...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {form.productId && form.code.trim() && (
                  <p className="text-[11px] text-muted-foreground break-all">
                    Link do código: <code className="text-foreground">{affiliateLink(form.code.trim().toUpperCase(), form.productId)}</code>
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Código anunciado *</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary" onClick={() => setForm({ ...form, code: '' })} disabled={Boolean(editingCode)}>
                  <Plus className="w-3 h-3 mr-1" /> Outro código
                </Button>
              </div>
              <Input ref={codeInputRef} value={form.code} disabled={Boolean(editingCode)} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={isPromoterForm ? 'Ex: DIVULGADOR1FINO' : 'Ex: JUNIOR10'} className="uppercase font-bold" />
              <p className="text-[11px] text-muted-foreground">
                {isPromoterForm
                  ? 'Um código por produto/vídeo. Cada cliente usa cada código uma única vez.'
                  : 'Cada código é independente e pode ter sua própria validade e desconto.'}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Validade do código (dias)</Label>
              <Input type="number" min="1" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) })} />
              <p className="text-[11px] text-muted-foreground">Define por quantos dias o código poderá ser usado. O link do afiliado não expira.</p>
            </div>
            <div className="space-y-1">
              <Label>{isPromoterForm ? 'Nome do divulgador' : 'Nome do influencer'}</Label>
              <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Ex: Junior Vox" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>{isPromoterForm ? 'E-mail da conta do divulgador *' : 'E-mail da conta do influencer *'}</Label>
              <Input value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder="influencer@email.com" />
              <p className="text-[11px] text-muted-foreground">É com este e-mail que ele vê o painel dele (códigos, links e retorno) em /afiliado.</p>
            </div>
            <div className="space-y-1">
              <Label>Desconto ao comprador (%)</Label>
              <Input type="number" min="0" max="100" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })} />
              {isPromoterForm && (
                <p className="text-[11px] text-muted-foreground">Opcional. Com 0% o código serve só para medir o retorno.</p>
              )}
            </div>
            {!isPromoterForm && (
            <div className="md:col-span-2 border-t pt-4">
              <p className="font-semibold mb-1">Metas e comissão por nível</p>
              <p className="text-xs text-muted-foreground mb-3">Até a meta 1: Bronze · até a meta 2: Prata · acima: Ouro.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {([
                  ['Nível 1 · Bronze', 'bronzeGoalYen', 'bronzePercent'],
                  ['Nível 2 · Prata', 'silverGoalYen', 'silverPercent'],
                  ['Nível 3 · Ouro', 'goldGoalYen', 'goldPercent'],
                ] as const).map(([label, goal, percent]) => (
                  <div key={goal} className="rounded-lg border p-3 space-y-2">
                    <Label>{label} · Meta (¥)</Label>
                    <Input type="number" min="0" value={form[goal]} onChange={(e) => setForm({ ...form, [goal]: Number(e.target.value) })} />
                    <Label>Comissão (%)</Label>
                    <Input type="number" min="0" max="100" value={form[percent]} onChange={(e) => setForm({ ...form, [percent]: Number(e.target.value) })} />
                  </div>
                ))}
              </div>
            </div>
            )}
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
              <Label className="cursor-pointer">Ativo</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      )}

      {/* Comissões pendentes — liberar ao confirmar a entrega */}
      {pending.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-xl p-5">
          <h3 className="font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300 mb-1">
            <Clock className="w-5 h-5" /> Comissões pendentes ({pending.length})
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-4">
            A comissão só é creditada ao influencer quando você confirma a entrega do pedido.
          </p>
          <div className="space-y-2">
            {pending.map((pc) => (
              <div key={pc.id} className="flex flex-wrap items-center justify-between gap-3 bg-card rounded-lg border border-border p-3">
                <div className="text-sm">
                  <span className="font-bold font-mono text-primary">{pc.affiliateCode}</span>
                  <span className="text-muted-foreground"> · Pedido {pc.orderId}</span>
                  <div className="text-xs text-muted-foreground">
                    {pc.buyerEmail || 'cliente'} · Venda líquida ¥{pc.netYen.toLocaleString()} · Comissão <strong className="text-green-600">¥{pc.commissionYen.toLocaleString()}</strong>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="btn-primary text-xs" onClick={() => handleConfirm(pc)}>
                    <CheckCircle className="w-4 h-4 mr-1" /> Confirmar entrega
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={() => handleCancelPending(pc)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vídeos de review enviados pelos divulgadores — aprovar publica no vlog */}
      {reviews.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-1">
            <Video className="w-5 h-5 text-primary" /> Vídeos de review ({reviews.filter((r) => r.status === 'pending').length} aguardando)
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            O divulgador cola o link no painel dele. Ao aprovar, o vídeo aparece no vlog com o link do produto.
          </p>
          <div className="space-y-2">
            {reviews.map((review) => (
              <div key={review.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 text-sm">
                  <a href={review.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground hover:text-primary break-all">
                    {review.title || review.url}
                  </a>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono font-bold text-primary">{review.code}</span>
                    {' · '}{review.ownerName || review.ownerEmail}
                    {review.productName ? ` · ${review.productName}` : ''}
                    {' · '}{review.platform}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    review.status === 'approved' ? 'bg-green-100 text-green-700' : review.status === 'rejected' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {review.status === 'approved' ? 'Publicado' : review.status === 'rejected' ? 'Recusado' : 'Aguardando'}
                  </span>
                  {review.status !== 'approved' && (
                    <Button size="sm" className="btn-primary text-xs" onClick={() => handleReview(review, 'approved')}>
                      <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                    </Button>
                  )}
                  {review.status !== 'rejected' && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => handleReview(review, 'rejected')}>
                      Recusar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={() => handleReview(review, 'deleted')} title="Excluir vídeo">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando afiliados...</div>
      ) : affiliates.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum afiliado cadastrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleEvaluateTiers} disabled={evaluating} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${evaluating ? 'animate-spin' : ''}`} />
              {evaluating ? 'Avaliando...' : 'Avaliar Níveis Agora'}
            </Button>
          </div>

          {/* Legenda de tiers */}
          <div className="flex gap-3 flex-wrap text-xs">
            {(Object.entries(TIER_CONFIG) as [AffiliateTier, typeof TIER_CONFIG[AffiliateTier]][]).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5 bg-secondary/40 rounded-lg px-3 py-1.5">
                <span>{cfg.emoji}</span>
                <span className="font-semibold">{cfg.label}</span>
                <span className="text-muted-foreground">{cfg.commissionPercent}% · meta ¥{cfg.goalYen.toLocaleString()}/mês</span>
              </div>
            ))}
          </div>

          <div className="grid gap-4">
            {affiliates.map((aff) => {
              const expired = new Date(aff.expiresAt) < new Date();
              if (isPromoter(aff)) {
                const link = affiliateLink(aff.code, aff.productId);
                const visits = aff.visitCount || 0;
                const buyers = aff.totalOrders || 0;
                return (
                  <div key={aff.code} className={`bg-card rounded-xl border p-6 ${!aff.active || expired ? 'border-border opacity-70' : 'border-sky-300/60'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-bold text-lg font-mono">{aff.code}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${aff.active && !expired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {expired ? 'Expirado' : aff.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-700">📣 Divulgador</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{aff.ownerName} · {aff.ownerEmail}</p>
                        <p className="text-sm mt-1">
                          <span className="text-muted-foreground">Produto enviado: </span>
                          <strong>{aff.productName || products.find((p) => p.id === aff.productId)?.name || aff.productId || '—'}</strong>
                        </p>
                        <div className="mt-3 flex items-center gap-2 bg-secondary/40 rounded-lg p-2">
                          <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <code className="text-xs text-foreground truncate flex-1">{link}</code>
                          <button onClick={() => copyLink(aff)} className="text-xs font-semibold text-primary hover:underline shrink-0">copiar</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
                          <div>
                            <p className="text-muted-foreground text-xs flex items-center gap-1"><Users className="w-3 h-3" /> Pessoas que vieram</p>
                            <p className="font-semibold text-lg">{visits}</p>
                            <p className="text-[11px] text-muted-foreground">{aff.linkVisits || 0} pelo link · {aff.codeVisits || 0} pelo código</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> Compraram</p>
                            <p className="font-semibold text-lg text-green-600">{buyers}</p>
                            <p className="text-[11px] text-muted-foreground">{visits > 0 ? `${Math.round((buyers / visits) * 100)}% de quem veio` : 'pedidos pagos'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Vendas geradas</p>
                            <p className="font-semibold text-lg">{yen(aff.totalRevenue)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Desconto</p>
                            <p className="font-semibold text-lg">{aff.discountPercent}%</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button variant="outline" size="sm" onClick={() => startEdit(aff)} title="Editar divulgador">
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => startAdditionalCode(aff)} title="Novo código para outro produto">
                            <Plus className="w-3 h-3 mr-1" /> Código (novo produto)
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyLink(aff)} title="Copiar link">
                          <Link2 className="w-4 h-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(aff.code)} title="Remover">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }
              const tier: AffiliateTier = aff.tier || 'bronze';
              const tierCfg = TIER_CONFIG[tier];
              const monthRev = aff.currentMonthRevenue || 0;
              const progress = Math.min(100, Math.round((monthRev / tierCfg.goalYen) * 100));
              const nextTierCfg = tierCfg.nextTier ? TIER_CONFIG[tierCfg.nextTier] : null;

              return (
                <div key={aff.code} className={`bg-card rounded-xl border p-6 ${!aff.active || expired ? 'border-border opacity-70' : 'border-primary/20'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="font-bold text-lg font-mono">{aff.code}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${aff.active && !expired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {expired ? 'Expirado' : aff.active ? 'Ativo' : 'Inativo'}
                        </span>
                        {/* Badge de nível */}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          tier === 'gold'   ? 'bg-yellow-100 text-yellow-700' :
                          tier === 'silver' ? 'bg-gray-100 text-gray-600' :
                                              'bg-orange-100 text-orange-700'
                        }`}>
                          {tierCfg.emoji} {tierCfg.label} · {tierCfg.commissionPercent}%
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{aff.ownerName} · {aff.ownerEmail}</p>

                      {/* Progresso da meta mensal */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Vendas este mês: <strong className="text-foreground">¥{monthRev.toLocaleString()}</strong></span>
                          <span>Meta {nextTierCfg ? `→ ${nextTierCfg.emoji}` : '✓'}: ¥{tierCfg.goalYen.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress >= 100 ? 'bg-green-500' :
                              progress >= 60  ? 'bg-amber-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {progress >= 100
                            ? `✅ Meta batida! ${nextTierCfg ? `Sobe para ${nextTierCfg.emoji} ${nextTierCfg.label} no próximo mês` : 'Mantém Ouro'}`
                            : tierCfg.prevTier
                              ? `⚠️ Faltam ¥${(tierCfg.goalYen - monthRev).toLocaleString()} para manter ${tierCfg.emoji} ${tierCfg.label}`
                              : `¥${(tierCfg.goalYen - monthRev).toLocaleString()} para subir para ${nextTierCfg?.emoji} ${nextTierCfg?.label}`}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center gap-2 bg-secondary/40 rounded-lg p-2">
                        <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <code className="text-xs text-foreground truncate flex-1">{affiliateLink(aff.code)}</code>
                        <button onClick={() => copyLink(aff)} className="text-xs font-semibold text-primary hover:underline shrink-0">copiar</button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mt-4">
                        <div><p className="text-muted-foreground text-xs">Desconto</p><p className="font-semibold">{aff.discountPercent}%</p></div>
                        <div><p className="text-muted-foreground text-xs">Comissão</p><p className="font-semibold">{aff.commissionPercent}%</p></div>
                        <div><p className="text-muted-foreground text-xs flex items-center gap-1"><Package className="w-3 h-3" /> Pedidos</p><p className="font-semibold">{aff.totalOrders || 0}</p></div>
                        <div><p className="text-muted-foreground text-xs flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Receita total</p><p className="font-semibold">{yen(aff.totalRevenue)}</p></div>
                      <Button variant="outline" size="sm" onClick={() => startEdit(aff)} title="Editar afiliado">
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startAdditionalCode(aff)} title="Adicionar outro código">
                        <Plus className="w-3 h-3 mr-1" /> Código
                      </Button>
                        <div><p className="text-muted-foreground text-xs flex items-center gap-1"><DollarSign className="w-3 h-3" /> Comissão acum.</p><p className="font-semibold text-green-600">{yen(aff.totalEarnings)}</p></div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyLink(aff)} title="Copiar link">
                        <Link2 className="w-4 h-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(aff.code)} title="Remover">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliateManager;
