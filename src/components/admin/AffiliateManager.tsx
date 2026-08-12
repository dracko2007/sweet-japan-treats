import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, Link2, TrendingUp, DollarSign, Package, X, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { affiliateService, Affiliate, PendingCommission, TIER_CONFIG, AffiliateTier } from '@/services/affiliateService';

const SITE_URL = 'https://japanexpress-store.com';

const AffiliateManager: React.FC = () => {
  const { toast } = useToast();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [pending, setPending] = useState<PendingCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState({
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
  });

  const load = async () => {
    setLoading(true);
    const [list, pend] = await Promise.all([
      affiliateService.getAll(),
      affiliateService.getPendingCommissions(),
    ]);
    setAffiliates(list.sort((a, b) => b.totalEarnings - a.totalEarnings));
    setPending(pend.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const [evaluating, setEvaluating] = useState(false);
  const handleEvaluateTiers = async () => {
    if (!confirm('Avaliar e atualizar o nível de todos os afiliados agora?\n\nIsso processa as vendas do mês atual e sobe/desce os níveis conforme as metas.')) return;
    setEvaluating(true);
    const res = await affiliateService.evaluateAllTiers();
    toast({
      title: '🏆 Níveis atualizados',
      description: `${res.updated} afiliado(s) processado(s)${res.errors ? ` · ${res.errors} erro(s)` : ''}`,
    });
    setEvaluating(false);
    load();
  };

  const handleResetAllAffiliates = async () => {
    if (!confirm('ATENÇÃO: resetar todos os afiliados?\n\nIsso apagará o nível e as vendas do mês atual de todos, retornando-os ao Bronze. O histórico total de vendas e ganhos será preservado.')) return;
    setEvaluating(true);
    const res = await affiliateService.resetAllAffiliates();
    toast({
      title: 'Afiliados resetados',
      description: `${res.updated} afiliado(s) retornaram ao Bronze${res.errors ? ` · ${res.errors} erro(s)` : ''}`,
    });
    setEvaluating(false);
    load();
  };

  const handleConfirm = async (pc: PendingCommission) => {
    if (!confirm(`Confirmar entrega e liberar comissão de ${pc.affiliateCode}?`)) return;
    const ok = await affiliateService.confirmPendingCommission(pc.id);
    if (ok) {
      toast({ title: '✅ Comissão liberada', description: `${pc.affiliateCode} · ¥${pc.commissionYen.toLocaleString()}` });
      load();
    } else {
      toast({ title: 'Erro ao confirmar', variant: 'destructive' });
    }
  };

  const handleCancelPending = async (pc: PendingCommission) => {
    if (!confirm(`Cancelar a comissão pendente de ${pc.affiliateCode} (pedido cancelado)?`)) return;
    const ok = await affiliateService.cancelPendingCommission(pc.id);
    if (ok) {
      toast({ title: 'Comissão cancelada' });
      load();
    }
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.ownerEmail.trim()) {
      toast({ title: 'Informe o código e o e-mail do influencer', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const ok = await affiliateService.save({
      code: form.code.toUpperCase(),
      ownerName: form.ownerName.trim() || form.code.toUpperCase(),
      ownerEmail: form.ownerEmail.trim(),
      discountPercent: Number(form.discountPercent),
      commissionPercent: Number(form.bronzePercent),
      tierSettings: {
        bronzeGoalYen: Number(form.bronzeGoalYen), bronzePercent: Number(form.bronzePercent),
        silverGoalYen: Number(form.silverGoalYen), silverPercent: Number(form.silverPercent),
        goldGoalYen: Number(form.goldGoalYen), goldPercent: Number(form.goldPercent),
      },
      active: form.active,
      expiresAt: new Date(Date.now() + form.validityDays * 86400000).toISOString(),
    });
    setSaving(false);
    if (ok) {
      setEditingCode(null);
      setCreating(false);
      setForm({ code: '', ownerName: '', ownerEmail: '', discountPercent: 10, commissionPercent: 10, validityDays: 90, active: true, bronzeGoalYen: 100000, bronzePercent: 10, silverGoalYen: 200000, silverPercent: 15, goldGoalYen: 201000, goldPercent: 20 });
      load();
    } else {
      toast({ title: 'Erro ao salvar afiliado', variant: 'destructive' });
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Remover o afiliado ${code}?`)) return;
    const res = await affiliateService.remove(code);
    if (res.ok) {
      toast({ title: '🗑️ Afiliado removido', description: code });
      load();
    } else {
      toast({
        title: 'Não foi possível remover',
        description: res.error?.includes('permission')
          ? 'Sem permissão (sessão de admin expirou). Saia e entre de novo como Administrador.'
          : (res.error || 'Tente novamente.'),
        variant: 'destructive',
      });
    }
  };
  const startEdit = (affiliate: Affiliate) => {
    const settings = affiliate.tierSettings;
    setEditingCode(affiliate.code);
    setForm({
      code: affiliate.code,
      ownerName: affiliate.ownerName,
      ownerEmail: affiliate.ownerEmail,
      discountPercent: affiliate.discountPercent,
      commissionPercent: affiliate.commissionPercent,
      validityDays: Math.max(1, Math.ceil((new Date(affiliate.expiresAt).getTime() - Date.now()) / 86400000)),
      active: affiliate.active,
      bronzeGoalYen: settings?.bronzeGoalYen || 100000,
      bronzePercent: settings?.bronzePercent || 10,
      silverGoalYen: settings?.silverGoalYen || 200000,
      silverPercent: settings?.silverPercent || 15,
      goldGoalYen: settings?.goldGoalYen || 201000,
      goldPercent: settings?.goldPercent || 20,
    });
    setCreating(true);
  };

  const copyLink = (code: string) => {
    const link = `${SITE_URL}/?ref=${code}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado', description: link });
  };

  const yen = (v: number) => `¥${(v || 0).toLocaleString()}`;

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
              Códigos públicos que dão desconto ao comprador e comissão ao influencer
            </p>
          </div>
        </div>
        <Button onClick={() => setCreating(!creating)} className="btn-primary">
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
              key === 'silver' ? 'border-gray-300 bg-gray-50/60 dark:bg-gray-900/30' :
              'border-orange-300 bg-orange-50/60 dark:bg-orange-950/20'
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
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">Cadastrar Influencer</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Código anunciado *</Label>
              <Input value={form.code} disabled={Boolean(editingCode)} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ex: JUNIOR10" className="uppercase font-bold" />
            </div>
            <div className="space-y-1">
              <Label>Nome do influencer</Label>
              <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Ex: Junior Vox" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>E-mail da conta do influencer *</Label>
              <Input value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder="influencer@email.com" />
              <p className="text-[11px] text-muted-foreground">É com este e-mail que o influencer vê o painel dele em /afiliado.</p>
            </div>
            <div className="space-y-1">
              <Label>Desconto ao comprador (%)</Label>
              <Input type="number" min="0" max="100" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })} />
            </div>
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
            <div className="space-y-1">
              <Label>Validade (dias)</Label>
              <Input type="number" min="1" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) })} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
              <Label className="cursor-pointer">Ativo</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
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
                        <code className="text-xs text-foreground truncate flex-1">{`${SITE_URL}/?ref=${aff.code}`}</code>
                        <button onClick={() => copyLink(aff.code)} className="text-xs font-semibold text-primary hover:underline shrink-0">copiar</button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mt-4">
                        <div><p className="text-muted-foreground text-xs">Desconto</p><p className="font-semibold">{aff.discountPercent}%</p></div>
                        <div><p className="text-muted-foreground text-xs">Comissão</p><p className="font-semibold">{aff.commissionPercent}%</p></div>
                        <div><p className="text-muted-foreground text-xs flex items-center gap-1"><Package className="w-3 h-3" /> Pedidos</p><p className="font-semibold">{aff.totalOrders || 0}</p></div>
                        <div><p className="text-muted-foreground text-xs flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Receita total</p><p className="font-semibold">{yen(aff.totalRevenue)}</p></div>
                      <Button variant="outline" size="sm" onClick={() => startEdit(aff)} title="Editar afiliado">
                        Editar
                      </Button>
                        <div><p className="text-muted-foreground text-xs flex items-center gap-1"><DollarSign className="w-3 h-3" /> Comissão acum.</p><p className="font-semibold text-green-600">{yen(aff.totalEarnings)}</p></div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyLink(aff.code)} title="Copiar link">
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
