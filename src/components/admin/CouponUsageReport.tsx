import React, { useEffect, useState } from 'react';
import { orderService } from '@/services/orderService';
import { toYen } from '@/utils/currency';
import { Tag, TrendingDown, ShoppingBag, Percent } from 'lucide-react';

interface CouponRow {
  orderNumber: string;
  orderDate: string;
  customerEmail: string;
  couponCode: string;
  couponDiscount: number;   // valor na moeda do pedido
  currency: string;
  discountYen: number;      // convertido para ¥
  grandTotalYen: number;    // valor total do pedido em ¥
  isAffiliate: boolean;
  affiliateCode: string;
}

const CouponUsageReport: React.FC = () => {
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCode, setFilterCode] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'coupon' | 'affiliate'>('all');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const orders = await orderService.getAllOrdersAsync();
    const result: CouponRow[] = [];

    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      const discount = (o as any).couponDiscount || 0;
      const code = (o as any).couponCode || '';
      const affCode = (o as any).affiliateCode || '';
      if (!discount && !code && !affCode) continue;

      const cur = (o as any).currency || 'BRL';
      // Derivar taxa implícita do pedido para converter desconto para ¥
      const grandTotalYen = (o as any).grandTotalYen || 0;
      const totalBrl = o.totalPrice || o.totalAmount || 0;
      let discountYen = 0;
      if (discount > 0) {
        if (cur === 'JPY') {
          discountYen = Math.round(discount);
        } else if (grandTotalYen > 0 && totalBrl > 0) {
          const rate = grandTotalYen / totalBrl;
          discountYen = Math.round(discount * rate);
        } else {
          discountYen = toYen(discount, cur);
        }
      }

      result.push({
        orderNumber: o.orderNumber || (o as any).id || '',
        orderDate: (o as any).orderDate || (o as any).date || '',
        customerEmail: (o as any).customerEmail || '',
        couponCode: code,
        couponDiscount: discount,
        currency: cur,
        discountYen,
        grandTotalYen,
        isAffiliate: !!affCode,
        affiliateCode: affCode,
      });
    }

    result.sort((a, b) => (b.orderDate > a.orderDate ? 1 : -1));
    setRows(result);
    setLoading(false);
  };

  const filtered = rows.filter(r => {
    if (filterType === 'coupon' && r.isAffiliate) return false;
    if (filterType === 'affiliate' && !r.isAffiliate) return false;
    if (filterCode && !r.couponCode.toLowerCase().includes(filterCode.toLowerCase()) && !r.affiliateCode.toLowerCase().includes(filterCode.toLowerCase())) return false;
    return true;
  });

  const totalDiscountYen = filtered.reduce((s, r) => s + r.discountYen, 0);
  const totalOrders = filtered.length;

  const byCode: Record<string, { count: number; totalYen: number; isAffiliate: boolean }> = {};
  filtered.forEach(r => {
    const key = r.affiliateCode || r.couponCode || '(sem código)';
    if (!byCode[key]) byCode[key] = { count: 0, totalYen: 0, isAffiliate: r.isAffiliate };
    byCode[key].count++;
    byCode[key].totalYen += r.discountYen;
  });
  const topCodes = Object.entries(byCode).sort((a, b) => b[1].totalYen - a[1].totalYen);

  const fmt = (v: number, cur: string) =>
    cur === 'JPY' ? `¥${v.toLocaleString()}` : `R$${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-1 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" /> Total Descontado
          </p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">≈¥{totalDiscountYen.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Receita que deixou de entrar</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5" /> Pedidos c/ desconto
          </p>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Percent className="w-3.5 h-3.5" /> Desconto Médio
          </p>
          <p className="text-2xl font-bold">≈¥{totalOrders > 0 ? Math.round(totalDiscountYen / totalOrders).toLocaleString() : 0}</p>
        </div>
      </div>

      {/* Top códigos */}
      {topCodes.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Tag className="w-4 h-4" /> Por Código</h3>
          <div className="space-y-2">
            {topCodes.map(([code, data]) => (
              <div key={code} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${data.isAffiliate ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'}`}>
                    {data.isAffiliate ? 'Afiliado' : 'Cupom'}
                  </span>
                  <span className="font-mono font-semibold">{code}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-amber-600">≈¥{data.totalYen.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">{data.count} uso{data.count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {(['all', 'coupon', 'affiliate'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-xs rounded-full font-semibold transition-colors ${filterType === t ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {t === 'all' ? 'Todos' : t === 'coupon' ? 'Cupons' : 'Afiliados'}
            </button>
          ))}
        </div>
        <input
          className="px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
          placeholder="Filtrar por código..."
          value={filterCode}
          onChange={e => setFilterCode(e.target.value)}
        />
      </div>

      {/* Tabela */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum desconto encontrado.</p>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Pedido</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Desconto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">≈¥</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.orderNumber.slice(-8)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.orderDate ? new Date(r.orderDate).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs truncate max-w-[140px]">{r.customerEmail || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-xs">
                        {r.affiliateCode || r.couponCode || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.isAffiliate ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'}`}>
                        {r.isAffiliate ? 'Afiliado' : 'Cupom'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-red-500 font-semibold text-xs">
                      {r.couponDiscount > 0 ? `−${fmt(r.couponDiscount, r.currency)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600 text-xs">
                      {r.discountYen > 0 ? `≈¥${r.discountYen.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 border-t-2 border-border">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-muted-foreground">Total ({filtered.length} pedidos)</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-red-500">—</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-amber-600">≈¥{totalDiscountYen.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponUsageReport;
