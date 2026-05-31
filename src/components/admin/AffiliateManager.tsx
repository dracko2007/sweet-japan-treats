import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, Link2, TrendingUp, DollarSign, Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { affiliateService, Affiliate } from '@/services/affiliateService';

const SITE_URL = 'https://japan-express.vercel.app';

const AffiliateManager: React.FC = () => {
  const { toast } = useToast();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    ownerName: '',
    ownerEmail: '',
    discountPercent: 10,
    commissionPercent: 10,
    validityDays: 90,
    active: true,
  });

  const load = async () => {
    setLoading(true);
    const list = await affiliateService.getAll();
    setAffiliates(list.sort((a, b) => b.totalEarnings - a.totalEarnings));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

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
      commissionPercent: Number(form.commissionPercent),
      active: form.active,
      expiresAt: new Date(Date.now() + form.validityDays * 86400000).toISOString(),
    });
    setSaving(false);
    if (ok) {
      toast({ title: '✅ Afiliado salvo', description: `Código ${form.code.toUpperCase()}` });
      setCreating(false);
      setForm({ code: '', ownerName: '', ownerEmail: '', discountPercent: 10, commissionPercent: 10, validityDays: 90, active: true });
      load();
    } else {
      toast({ title: 'Erro ao salvar afiliado', variant: 'destructive' });
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Remover o afiliado ${code}?`)) return;
    const ok = await affiliateService.remove(code);
    if (ok) {
      toast({ title: '🗑️ Afiliado removido', description: code });
      load();
    }
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

      {creating && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">Cadastrar Influencer</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Código anunciado *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ex: JUNIOR10" className="uppercase font-bold" />
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
            <div className="space-y-1">
              <Label>Comissão do influencer (%)</Label>
              <Input type="number" min="0" max="100" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: Number(e.target.value) })} />
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

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando afiliados...</div>
      ) : affiliates.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum afiliado cadastrado</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {affiliates.map((aff) => {
            const expired = new Date(aff.expiresAt) < new Date();
            return (
              <div key={aff.code} className={`bg-card rounded-xl border p-6 ${!aff.active || expired ? 'border-border opacity-70' : 'border-primary/20'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-bold text-lg font-mono">{aff.code}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${aff.active && !expired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {expired ? 'Expirado' : aff.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{aff.ownerName} · {aff.ownerEmail}</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mt-4">
                      <div><p className="text-muted-foreground text-xs">Desconto</p><p className="font-semibold">{aff.discountPercent}%</p></div>
                      <div><p className="text-muted-foreground text-xs">Comissão</p><p className="font-semibold">{aff.commissionPercent}%</p></div>
                      <div><p className="text-muted-foreground text-xs flex items-center gap-1"><Package className="w-3 h-3" /> Vendas</p><p className="font-semibold">{aff.totalOrders || 0}</p></div>
                      <div><p className="text-muted-foreground text-xs flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Receita</p><p className="font-semibold">{yen(aff.totalRevenue)}</p></div>
                      <div><p className="text-muted-foreground text-xs flex items-center gap-1"><DollarSign className="w-3 h-3" /> Comissão acum.</p><p className="font-semibold text-green-600">{yen(aff.totalEarnings)}</p></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyLink(aff.code)} title="Copiar link de indicação">
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
      )}
    </div>
  );
};

export default AffiliateManager;
