import React, { useState, useEffect } from 'react';
import { Handshake, CheckCircle2, XCircle, Hourglass, ChevronDown, ChevronUp, Package, User, Truck } from 'lucide-react';
import { negotiationService } from '@/services/negotiationService';
import { Negotiation, NegotiationStatus } from '@/types/negotiation';
import { formatPrice } from '@/utils/currency';
import { convertYen as fxConvert } from '@/services/fxService';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const STATUS_LABELS: Record<NegotiationStatus, string> = {
  pending: 'Aguardando',
  auto_approved: 'Aprovado automático',
  approved: 'Aprovado',
  rejected: 'Recusado',
};

const STATUS_COLORS: Record<NegotiationStatus, string> = {
  pending: 'bg-orange-100 text-orange-700 border-orange-300',
  auto_approved: 'bg-green-100 text-green-700 border-green-300',
  approved: 'bg-green-100 text-green-700 border-green-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
};

function fmt(yen: number) {
  return `¥${yen.toLocaleString('ja-JP')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const NegotiationRow: React.FC<{ neg: Negotiation }> = ({ neg }) => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [approveInput, setApproveInput] = useState(String(neg.requestedDiscountYen));
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  const displayCurrency = neg.currency || 'BRL';
  const convert = (yen: number) => fxConvert(yen, displayCurrency as 'BRL' | 'EUR' | 'JPY');

  const isPending = neg.status === 'pending';
  const isResolved = neg.status === 'approved' || neg.status === 'auto_approved' || neg.status === 'rejected';

  const handleApprove = async () => {
    const discount = parseInt(approveInput, 10) || 0;
    if (discount <= 0) { toast({ title: 'Informe o desconto a aprovar', variant: 'destructive' }); return; }
    if (discount >= neg.originalAmountYen) { toast({ title: 'Desconto não pode ser igual ou maior que o valor', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await negotiationService.approve(neg.id, discount, adminNote);
      toast({ title: '✅ Negociação aprovada!', description: `Desconto de ${fmt(discount)} aplicado.` });
    } catch {
      toast({ title: 'Erro ao aprovar', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await negotiationService.reject(neg.id, adminNote);
      toast({ title: '❌ Negociação recusada.' });
    } catch {
      toast({ title: 'Erro ao recusar', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className={`rounded-2xl border ${isPending ? 'border-orange-300 bg-orange-50/30 dark:bg-orange-950/10' : 'border-border bg-card'} overflow-hidden`}>
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${STATUS_COLORS[neg.status]}`}>
              {neg.status === 'pending' && <Hourglass className="w-3 h-3" />}
              {(neg.status === 'approved' || neg.status === 'auto_approved') && <CheckCircle2 className="w-3 h-3" />}
              {neg.status === 'rejected' && <XCircle className="w-3 h-3" />}
              {STATUS_LABELS[neg.status]}
            </span>
            <span className="text-xs font-semibold text-foreground">
              {neg.type === 'ps_fee' ? '🤝 Taxa PS' : '🚚 Frete'}
            </span>
            <span className="text-xs text-muted-foreground">
              de {fmt(neg.originalAmountYen)} → pedido: {fmt(neg.requestedDiscountYen)} off
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{neg.userName} ({neg.userEmail})</span>
            <span>{fmtDate(neg.createdAt)}</span>
            <span>{neg.cartItems.length} produto(s) · {neg.numUnits} unidade(s)</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-border/60 space-y-5">

          {/* Cart items */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 mt-4">
              <Package className="w-3.5 h-3.5 inline mr-1" />Itens do Carrinho
            </h4>
            <div className="space-y-2">
              {neg.cartItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-secondary/30">
                  <img src={item.productImage} alt={item.productName} className="w-10 h-10 rounded-lg object-cover border border-border" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.variantLabel || item.size} · {item.quantity}x · {fmt(item.priceYen)}/un</p>
                  </div>
                  <span className="text-sm font-bold">{fmt(item.priceYen * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping */}
          {neg.shipping && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/30 rounded-xl px-4 py-2">
              <Truck className="w-4 h-4" />
              <span>{neg.shipping.carrier} · {neg.shipping.estimatedDays} dias · {fmt(neg.shipping.costYen)}</span>
            </div>
          )}

          {/* Client note */}
          {neg.clientNote && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5 text-sm text-blue-800 dark:text-blue-200">
              <span className="font-semibold">Mensagem do cliente: </span>{neg.clientNote}
            </div>
          )}

          {/* Negotiation values */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Valor original</p>
              <p className="font-bold">{fmt(neg.originalAmountYen)}</p>
              <p className="text-xs text-muted-foreground">{formatPrice(convert(neg.originalAmountYen), displayCurrency as 'BRL' | 'EUR' | 'JPY')}</p>
            </div>
            <div className="bg-card border border-orange-200 dark:border-orange-700 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Desconto pedido</p>
              <p className="font-bold text-orange-600">{fmt(neg.requestedDiscountYen)}</p>
              {neg.type === 'ps_fee' && (
                <p className="text-xs text-muted-foreground">
                  Máx. auto: {fmt(300 * neg.numUnits)}
                </p>
              )}
            </div>
            {isResolved && neg.approvedDiscountYen != null && (
              <div className="bg-card border border-green-200 dark:border-green-700 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Desconto aprovado</p>
                <p className="font-bold text-green-600">{fmt(neg.approvedDiscountYen)}</p>
                <p className="text-xs text-muted-foreground">
                  Final: {fmt(neg.originalAmountYen - neg.approvedDiscountYen)}
                </p>
              </div>
            )}
            {isResolved && neg.status === 'rejected' && (
              <div className="bg-card border border-red-200 dark:border-red-700 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Resultado</p>
                <p className="font-bold text-red-600">Recusado</p>
              </div>
            )}
          </div>

          {/* Admin action panel */}
          {isPending && (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h4 className="text-sm font-bold text-foreground">Responder Proposta</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Desconto a aprovar (¥) <span className="text-orange-500">— sugerido: {fmt(neg.requestedDiscountYen)}</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={approveInput}
                    onChange={e => setApproveInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Nota para o cliente</label>
                  <input
                    type="text"
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
                    placeholder="Ex: Aprovado como cortesia!"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleApprove} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {saving ? 'Salvando...' : 'Aprovar'}
                </Button>
                <Button onClick={handleReject} disabled={saving} variant="outline" className="flex-1 border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                  <XCircle className="w-4 h-4 mr-1.5" />
                  Recusar
                </Button>
              </div>
            </div>
          )}

          {/* Admin note (resolved) */}
          {isResolved && neg.adminNote && (
            <div className="bg-secondary/40 rounded-xl px-4 py-2.5 text-sm text-muted-foreground">
              <span className="font-semibold">Nota da vendedora: </span>{neg.adminNote}
            </div>
          )}

          {neg.resolvedAt && (
            <p className="text-xs text-muted-foreground text-right">Resolvido em {fmtDate(neg.resolvedAt)}</p>
          )}
        </div>
      )}
    </div>
  );
};

const NegotiationManager: React.FC = () => {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');

  useEffect(() => {
    return negotiationService.listenAll(setNegotiations);
  }, []);

  const pending = negotiations.filter(n => n.status === 'pending');
  const resolved = negotiations.filter(n => n.status !== 'pending');
  const shown = filter === 'all' ? negotiations : filter === 'pending' ? pending : resolved;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-orange-500">{pending.length}</p>
          <p className="text-xs text-muted-foreground font-semibold uppercase mt-1">Aguardando</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-green-600">{negotiations.filter(n => n.status === 'approved' || n.status === 'auto_approved').length}</p>
          <p className="text-xs text-muted-foreground font-semibold uppercase mt-1">Aprovadas</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-red-500">{negotiations.filter(n => n.status === 'rejected').length}</p>
          <p className="text-xs text-muted-foreground font-semibold uppercase mt-1">Recusadas</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {(['pending', 'all', 'resolved'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}
          >
            {f === 'pending' ? `Aguardando (${pending.length})` : f === 'all' ? `Todas (${negotiations.length})` : `Resolvidas (${resolved.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {shown.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Handshake className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Nenhuma negociação {filter === 'pending' ? 'pendente' : filter === 'resolved' ? 'resolvida' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(neg => <NegotiationRow key={neg.id} neg={neg} />)}
        </div>
      )}
    </div>
  );
};

export default NegotiationManager;
