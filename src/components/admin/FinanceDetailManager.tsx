// Aba "Financeiro > Impostos & Importação" — o detalhe burocrático que o
// Dashboard (visão geral) não cobre: quanto custa importar como a filial
// brasileira, quanto o banco desconta de IOF na remessa Brasil→Japão, quanto
// sobra de lucro depois do imposto pessoal no Japão (individual/個人事業主) e
// um registro de despesas operacionais (caixas, sacolas personalizadas etc.)
// vinculado ao mesmo resumo que já mostra cupom, pontos, afiliados e
// influencer — tudo puxado das MESMAS fontes que o Dashboard usa, para os
// dois painéis nunca divergirem.
//
// Cálculos em src/utils/companyFinance.ts — leia o cabeçalho de lá antes de
// mexer nas alíquotas.
import React, { useEffect, useMemo, useState } from 'react';
import { db } from '@/config/firebase';
import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy } from 'firebase/firestore';
import { z } from 'zod';
import {
  Package, Plus, Trash2, Landmark, Ship, Banknote, Calculator,
  Tag, Gift, Megaphone, Users, Briefcase, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/services/authenticatedFetch';
import { affiliateService } from '@/services/affiliateService';
import type { Affiliate, PendingCommission } from '@/services/affiliateService';
import { getMarketingExpenses } from '@/components/admin/MarketingManager';
import type { MarketingExpense } from '@/components/admin/MarketingManager';
import { getEmployeePayments } from '@/components/admin/EmployeeManager';
import type { EmployeePayment } from '@/components/admin/EmployeeManager';
import { getRates, loadFxRates, convertYen, yenFromConverted, getRateSource } from '@/services/fxService';
import { getAirParcelRate, getEmsRate } from '@/utils/japanPostRates';
import { ICMS_BY_UF, icmsRateFromCep } from '@/utils/taxRules';
import {
  calcBrImportLandedCost, calcIofRemittance, calcJpIndividualTax,
  IOF_PURPOSE_LABELS, IOF_RATES, BLUE_RETURN_DEDUCTIONS,
  type IofPurpose, type BlueReturnDeduction,
} from '@/utils/companyFinance';

// ── Despesas operacionais (Firestore) ─────────────────────────────────────
export const FINANCE_EXPENSE_CATEGORIES = [
  { id: 'caixas_envio', label: '📦 Caixas de Envio' },
  { id: 'sacolas_personalizadas', label: '🛍️ Sacolas Personalizadas' },
  { id: 'embalagem', label: '🎈 Plástico Bolha / Embalagem' },
  { id: 'etiquetas', label: '🏷️ Etiquetas / Impressão' },
  { id: 'material_escritorio', label: '🖇️ Material de Escritório' },
  { id: 'taxas_bancarias', label: '🏦 Taxas Bancárias / Câmbio' },
  { id: 'outro', label: '📋 Outro' },
] as const;
export type FinanceExpenseCategory = (typeof FINANCE_EXPENSE_CATEGORIES)[number]['id'];

export interface FinanceExpense {
  id?: string;
  date: string;
  category: FinanceExpenseCategory;
  description: string;
  amount: number;
  currency: 'BRL' | 'JPY';
  deductible: boolean;
  createdAt?: string;
}

const EXPENSE_COL = 'finance_expenses';

export async function getFinanceExpenses(): Promise<FinanceExpense[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, EXPENSE_COL), orderBy('date', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinanceExpense));
  } catch {
    return [];
  }
}

const emptyExpense = (): Omit<FinanceExpense, 'id' | 'createdAt'> => ({
  date: new Date().toISOString().slice(0, 10),
  category: 'caixas_envio',
  description: '',
  amount: 0,
  currency: 'BRL',
  deductible: true,
});

// ── Payload do resumo consolidado (mesma API do Dashboard) ───────────────
const financeSchema = z.object({
  ok: z.literal(true),
  finance: z.object({
    receitaProduto: z.number(),
    receitaPS: z.number(),
    custo: z.number(),
    descontosCupomYen: z.number(),
    pontosResgatadosYen: z.number(),
  }),
});

const YEN_PER_BRL_FALLBACK = 28;

const SUB_TABS = [
  { id: 'resumo', label: 'Resumo Consolidado', icon: Landmark },
  { id: 'despesas', label: 'Despesas', icon: Package },
  { id: 'importacao', label: 'Importação Brasil', icon: Ship },
  { id: 'cambio', label: 'Câmbio & IOF', icon: Banknote },
  { id: 'imposto', label: 'Imposto Japão (PF)', icon: Calculator },
] as const;
type SubTab = (typeof SUB_TABS)[number]['id'];

const yen = (v: number) => `¥${Math.round(v).toLocaleString('ja-JP')}`;
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const FinanceDetailManager: React.FC = () => {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>('resumo');

  // ── Dados consolidados (Resumo) ──
  const [loading, setLoading] = useState(true);
  const [receitaProduto, setReceitaProduto] = useState(0);
  const [receitaPS, setReceitaPS] = useState(0);
  const [custoProdutos, setCustoProdutos] = useState(0);
  const [descontosCupomYen, setDescontosCupomYen] = useState(0);
  const [pontosResgatadosYen, setPontosResgatadosYen] = useState(0);
  const [comissoesYen, setComissoesYen] = useState(0);
  const [marketingAds, setMarketingAds] = useState<MarketingExpense[]>([]);
  const [marketingInf, setMarketingInf] = useState<MarketingExpense[]>([]);
  const [salaries, setSalaries] = useState<EmployeePayment[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);

  const loadResumo = async () => {
    setLoading(true);
    try {
      const [dashRes, pending, affiliates, marketing, pay, opEx] = await Promise.all([
        authenticatedFetch('/api/admin-dashboard').catch(() => null),
        affiliateService.getPendingCommissions().catch(() => [] as PendingCommission[]),
        affiliateService.getAll().catch(() => [] as Affiliate[]),
        getMarketingExpenses().catch(() => [] as MarketingExpense[]),
        getEmployeePayments().catch(() => [] as EmployeePayment[]),
        getFinanceExpenses().catch(() => [] as FinanceExpense[]),
      ]);
      if (dashRes?.ok) {
        const parsed = financeSchema.parse(await dashRes.json());
        setReceitaProduto(parsed.finance.receitaProduto);
        setReceitaPS(parsed.finance.receitaPS);
        setCustoProdutos(parsed.finance.custo);
        setDescontosCupomYen(parsed.finance.descontosCupomYen);
        setPontosResgatadosYen(parsed.finance.pontosResgatadosYen);
      }
      const comissoesPendentes = pending.reduce((s, p) => s + (p.commissionYen || 0), 0);
      const comissoesLiberadas = affiliates.reduce((s, a) => s + (a.totalEarnings || 0), 0);
      setComissoesYen(comissoesPendentes + comissoesLiberadas);
      setMarketingAds(marketing.filter((m) => m.type === 'ads'));
      setMarketingInf(marketing.filter((m) => m.type === 'influencer'));
      setSalaries(pay);
      setExpenses(opEx);
    } catch {
      toast({ title: 'Não foi possível carregar o resumo financeiro', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadResumo(); }, []);

  const toYenSum = (items: { amount: number; currency: 'BRL' | 'JPY' }[]) =>
    items.reduce((s, i) => s + (i.currency === 'JPY' ? i.amount : Math.round(i.amount * YEN_PER_BRL_FALLBACK)), 0);

  const marketingAdsYen = toYenSum(marketingAds);
  const marketingInfYen = toYenSum(marketingInf);
  const salariosYen = toYenSum(salaries);
  const despesasDedutiveisYen = toYenSum(expenses.filter((e) => e.deductible));
  const despesasNaoDedutiveisYen = toYenSum(expenses.filter((e) => !e.deductible));

  const lucroAntesImpostoJapao = receitaProduto + receitaPS
    - custoProdutos - comissoesYen - marketingAdsYen - marketingInfYen - salariosYen - despesasDedutiveisYen;

  // ── Despesas: formulário ──
  const [expForm, setExpForm] = useState(emptyExpense());
  const [savingExp, setSavingExp] = useState(false);

  const handleSaveExpense = async () => {
    if (!expForm.description || expForm.amount <= 0) {
      toast({ title: 'Preencha a descrição e o valor', variant: 'destructive' });
      return;
    }
    if (!db) return;
    setSavingExp(true);
    try {
      await addDoc(collection(db, EXPENSE_COL), { ...expForm, createdAt: new Date().toISOString() });
      toast({ title: 'Despesa registrada!' });
      setExpForm(emptyExpense());
      setExpenses(await getFinanceExpenses());
    } catch {
      toast({ title: 'Erro ao salvar despesa', variant: 'destructive' });
    }
    setSavingExp(false);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, EXPENSE_COL, id));
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  // ── Importação Brasil ──
  const [rates, setRates] = useState(getRates());
  const [rateSource, setRateSource] = useState(getRateSource());
  const doRefreshRates = () => loadFxRates().then((r) => { setRates(r); setRateSource(getRateSource()); });
  useEffect(() => { void doRefreshRates(); }, []);

  const [impProductYen, setImpProductYen] = useState('');
  const [impShipYen, setImpShipYen] = useState('');
  const [impWeightKg, setImpWeightKg] = useState('');
  const [impUf, setImpUf] = useState<keyof typeof ICMS_BY_UF>('SP');

  const weightG = Math.round((parseFloat(impWeightKg) || 0) * 1000);
  const estimatedShipYen = weightG > 0
    ? (getAirParcelRate(weightG, 5) ?? getEmsRate(weightG, 5) ?? 0)
    : 0;
  const effectiveShipYen = parseFloat(impShipYen) || estimatedShipYen;

  const usdPerYen = rates.USD;
  const brlPerYen = rates.BRL;
  const brImport = useMemo(() => calcBrImportLandedCost({
    productCostYen: parseFloat(impProductYen) || 0,
    shippingCostYen: effectiveShipYen,
    usdPerYen,
    brlPerYen,
    icmsRate: ICMS_BY_UF[impUf],
  }), [impProductYen, effectiveShipYen, usdPerYen, brlPerYen, impUf]);

  // ── Câmbio & IOF ──
  const [remitBRL, setRemitBRL] = useState('');
  const [iofPurpose, setIofPurpose] = useState<IofPurpose>('pagamento_importacao');
  const iofResult = calcIofRemittance(parseFloat(remitBRL) || 0, iofPurpose);
  const liquidoYen = yenFromConverted(iofResult.liquidoBRL, 'BRL');

  // ── Imposto Japão (pessoa física) ──
  const [taxProfitYen, setTaxProfitYen] = useState('');
  const [blueDeduction, setBlueDeduction] = useState<BlueReturnDeduction>(650_000);
  const [basicDeduction, setBasicDeduction] = useState('480000');
  const [otherDeductions, setOtherDeductions] = useState('0');
  const applyResumoProfit = () => setTaxProfitYen(String(Math.max(0, Math.round(lucroAntesImpostoJapao))));
  const jpTax = calcJpIndividualTax({
    netProfitYen: parseFloat(taxProfitYen) || 0,
    blueReturnDeduction: blueDeduction,
    basicDeduction: parseFloat(basicDeduction) || 0,
    otherDeductions: parseFloat(otherDeductions) || 0,
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Detalhamento burocrático do negócio: importação como filial, IOF da remessa Brasil→Japão e imposto
        pessoal no Japão (個人事業主). Valores são <strong>estimativas com alíquota vigente em 2026</strong> —
        confirme com contador/despachante antes de decidir.
      </p>

      {/* Sub-navegação */}
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                subTab === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Resumo Consolidado ── */}
      {subTab === 'resumo' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={loadResumo} disabled={loading} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted/70 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Receita (produto + PS)</p>
              <p className="text-xl font-bold">{yen(receitaProduto + receitaPS)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Custo dos Produtos</p>
              <p className="text-xl font-bold text-gray-500">−{yen(custoProdutos)}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-center gap-1.5 mb-1"><Tag className="w-3.5 h-3.5 text-amber-600" /><p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Cupons dados</p></div>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300">≈{yen(descontosCupomYen)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Já descontado da receita — informativo</p>
            </div>
            <div className="bg-fuchsia-50 dark:bg-fuchsia-950/20 rounded-xl border border-fuchsia-200 dark:border-fuchsia-800 p-4">
              <div className="flex items-center gap-1.5 mb-1"><Gift className="w-3.5 h-3.5 text-fuchsia-600" /><p className="text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-400">Pontos pagos (resgate)</p></div>
              <p className="text-xl font-bold text-fuchsia-700 dark:text-fuchsia-300">≈{yen(pontosResgatadosYen)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Já descontado da receita — informativo</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-orange-500" /><p className="text-xs text-muted-foreground">Comissões Afiliados</p></div>
              <p className="text-xl font-bold text-orange-500">−{yen(comissoesYen)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-1"><Megaphone className="w-3.5 h-3.5 text-blue-500" /><p className="text-xs text-muted-foreground">Marketing — Ads</p></div>
              <p className="text-xl font-bold text-blue-500">−{yen(marketingAdsYen)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-1"><Megaphone className="w-3.5 h-3.5 text-purple-500" /><p className="text-xs text-muted-foreground">Marketing — Influencer</p></div>
              <p className="text-xl font-bold text-purple-500">−{yen(marketingInfYen)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-1"><Briefcase className="w-3.5 h-3.5 text-red-500" /><p className="text-xs text-muted-foreground">Salários</p></div>
              <p className="text-xl font-bold text-red-500">−{yen(salariosYen)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 mb-1"><Package className="w-3.5 h-3.5 text-teal-500" /><p className="text-xs text-muted-foreground">Despesas Operacionais</p></div>
              <p className="text-xl font-bold text-teal-600">−{yen(despesasDedutiveisYen)}</p>
              {despesasNaoDedutiveisYen > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">+ {yen(despesasNaoDedutiveisYen)} não dedutível</p>
              )}
            </div>
          </div>

          <div className={`rounded-xl border-2 p-5 ${lucroAntesImpostoJapao >= 0 ? 'bg-green-50 dark:bg-green-950/20 border-green-400 dark:border-green-700' : 'bg-red-50 dark:bg-red-950/20 border-red-400'}`}>
            <p className="text-sm font-semibold text-muted-foreground mb-1">💵 Lucro Antes do Imposto (Japão)</p>
            <p className={`text-3xl font-bold ${lucroAntesImpostoJapao >= 0 ? 'text-green-600' : 'text-red-600'}`}>{yen(lucroAntesImpostoJapao)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              (Produto + PS) − Custo − Afiliados − Marketing − Salários − Despesas dedutíveis. Não inclui II/ICMS/IOF
              (esses são custo de importação da filial no Brasil, apurados na aba "Importação Brasil").
            </p>
            <Button size="sm" className="mt-3" onClick={() => { setSubTab('imposto'); applyResumoProfit(); }}>
              Calcular imposto no Japão com este lucro →
            </Button>
          </div>
        </div>
      )}

      {/* ── Despesas ── */}
      {subTab === 'despesas' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><Plus className="w-5 h-5" /> Registrar Despesa</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
                <select value={expForm.category} onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value as FinanceExpenseCategory }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {FINANCE_EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição do item</label>
                <input value={expForm.description} onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ex: 200 caixas 20x15x10cm" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
                <input type="date" value={expForm.date} onChange={(e) => setExpForm((f) => ({ ...f, date: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor Pago</label>
                <input type="number" min="0" step="0.01" value={expForm.amount || ''} onChange={(e) => setExpForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} placeholder="0,00" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Moeda</label>
                <select value={expForm.currency} onChange={(e) => setExpForm((f) => ({ ...f, currency: e.target.value as 'BRL' | 'JPY' }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="BRL">BRL (R$)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={expForm.deductible} onChange={(e) => setExpForm((f) => ({ ...f, deductible: e.target.checked }))} />
                  Dedutível como despesa no Japão
                </label>
              </div>
            </div>
            <Button onClick={handleSaveExpense} disabled={savingExp} className="w-full sm:w-auto">
              {savingExp ? 'Salvando...' : 'Adicionar Despesa'}
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-lg mb-4">Histórico de Despesas</h3>
            {expenses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhuma despesa registrada</p>
            ) : (
              <div className="space-y-3">
                {expenses.map((e) => {
                  const cat = FINANCE_EXPENSE_CATEGORIES.find((c) => c.id === e.category);
                  return (
                    <div key={e.id} className="flex items-start justify-between gap-3 border border-border rounded-lg p-4">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{e.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(e.date).toLocaleDateString('pt-BR')} · {cat?.label || e.category}
                          {!e.deductible && <span className="ml-2 text-amber-600">(não dedutível)</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-sm">{e.currency === 'BRL' ? brl(e.amount) : yen(e.amount)}</span>
                        <button onClick={() => e.id && handleDeleteExpense(e.id)} className="text-muted-foreground hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Importação Brasil ── */}
      {subTab === 'importacao' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-lg mb-1">Custo de Importar como Filial (Remessa Conforme)</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Câmbio ao vivo ({rateSource}) · <button onClick={doRefreshRates} className="underline">atualizar</button>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Custo do Produto (¥)</label>
                <input type="number" min="0" value={impProductYen} onChange={(e) => setImpProductYen(e.target.value)} placeholder="10000" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Peso (kg, opcional)</label>
                <input type="number" min="0" step="0.1" value={impWeightKg} onChange={(e) => setImpWeightKg(e.target.value)} placeholder="2" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                {estimatedShipYen > 0 && <p className="text-[11px] text-muted-foreground mt-1">Frete estimado: {yen(estimatedShipYen)}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Frete Pago (¥, opcional — sobrepõe o peso)</label>
                <input type="number" min="0" value={impShipYen} onChange={(e) => setImpShipYen(e.target.value)} placeholder={String(estimatedShipYen || '')} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">UF de Destino (ICMS)</label>
                <select value={impUf} onChange={(e) => setImpUf(e.target.value as keyof typeof ICMS_BY_UF)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {Object.entries(ICMS_BY_UF).map(([uf, rate]) => <option key={uf} value={uf}>{uf} — {(rate * 100).toFixed(1)}%</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Valor Aduaneiro</p>
              <p className="text-xl font-bold">{brl(brImport.valorAduaneiroBRL)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">≈ US$ {brImport.valorAduaneiroUSD.toFixed(2)} · produto + frete</p>
            </div>
            <div className={`rounded-xl border p-4 ${brImport.isentoII ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-card border-border'}`}>
              <p className="text-xs text-muted-foreground mb-1">Imposto de Importação (II — 60%)</p>
              <p className="text-xl font-bold">{brImport.isentoII ? 'Isento (≤ US$50)' : brl(brImport.iiBRL)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">ICMS ({(ICMS_BY_UF[impUf] * 100).toFixed(1)}%, cálculo "por dentro")</p>
              <p className="text-xl font-bold">{brl(brImport.icmsBRL)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Total de Impostos</p>
              <p className="text-xl font-bold text-red-500">−{brl(brImport.totalImpostosBRL)}</p>
            </div>
          </div>

          <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5">
            <p className="text-sm font-semibold text-muted-foreground mb-1">Custo Total Desembaraçado</p>
            <p className="text-2xl font-bold">{brl(brImport.custoTotalBRL)}</p>
            <p className="text-xs text-muted-foreground mt-1">≈ {yen(brImport.custoTotalYen)}</p>
          </div>
        </div>
      )}

      {/* ── Câmbio & IOF ── */}
      {subTab === 'cambio' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-lg mb-4">IOF na Remessa Brasil → Japão</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor a Transferir (R$)</label>
                <input type="number" min="0" step="0.01" value={remitBRL} onChange={(e) => setRemitBRL(e.target.value)} placeholder="0,00" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Finalidade da Remessa</label>
                <select value={iofPurpose} onChange={(e) => setIofPurpose(e.target.value as IofPurpose)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {(Object.keys(IOF_RATES) as IofPurpose[]).map((p) => (
                    <option key={p} value={p}>{IOF_PURPOSE_LABELS[p]} — {(IOF_RATES[p] * 100).toFixed(2)}%</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O banco decide a alíquota final pelo código de natureza cambial informado no fechamento — confirme com a instituição financeira.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">IOF</p>
              <p className="text-xl font-bold text-red-500">−{brl(iofResult.iofBRL)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Valor Líquido (R$)</p>
              <p className="text-xl font-bold">{brl(iofResult.liquidoBRL)}</p>
            </div>
            <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground mb-1">Recebido no Japão (≈¥)</p>
              <p className="text-xl font-bold">{yen(liquidoYen)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Imposto Japão (pessoa física) ── */}
      {subTab === 'imposto' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-lg mb-1">Imposto Pessoal no Japão (個人事業主)</h3>
            <p className="text-xs text-muted-foreground mb-4">
              所得税 + 復興特別所得税 (2,1%) + 住民税 (10%) + 個人事業税 (5%, comércio). Sem CNPJ de pessoa jurídica —
              não é 法人税.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Lucro Anual do Negócio (¥, antes das deduções abaixo)</label>
                <div className="flex gap-2">
                  <input type="number" min="0" value={taxProfitYen} onChange={(e) => setTaxProfitYen(e.target.value)} placeholder="0" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  <Button variant="outline" size="sm" onClick={applyResumoProfit}>Usar do Resumo</Button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">青色申告特別控除</label>
                <select value={blueDeduction} onChange={(e) => setBlueDeduction(Number(e.target.value) as BlueReturnDeduction)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {BLUE_RETURN_DEDUCTIONS.map((d) => <option key={d} value={d}>¥{d.toLocaleString()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">基礎控除 (IR)</label>
                <input type="number" min="0" value={basicDeduction} onChange={(e) => setBasicDeduction(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Outras Deduções (INSS/国民年金 etc.)</label>
                <input type="number" min="0" value={otherDeductions} onChange={(e) => setOtherDeductions(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">所得税 (IR nacional)</p>
              <p className="text-xl font-bold text-red-500">−{yen(jpTax.incomeTax)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">復興特別所得税 (2,1%)</p>
              <p className="text-xl font-bold text-red-500">−{yen(jpTax.reconstructionSurtax)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">住民税 (10% + 均等割)</p>
              <p className="text-xl font-bold text-red-500">−{yen(jpTax.residentTax + jpTax.residentTaxPerCapita)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">個人事業税 (5%, acima de ¥2,9M)</p>
              <p className="text-xl font-bold text-red-500">−{yen(jpTax.businessTax)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Base Tributável (IR)</p>
              <p className="text-xl font-bold">{yen(jpTax.taxableForIncomeTax)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Total de Impostos</p>
              <p className="text-xl font-bold text-red-600">−{yen(jpTax.totalTax)}</p>
            </div>
          </div>

          <div className={`rounded-xl border-2 p-5 ${jpTax.netProfitAfterTax >= 0 ? 'bg-green-50 dark:bg-green-950/20 border-green-400 dark:border-green-700' : 'bg-red-50 dark:bg-red-950/20 border-red-400'}`}>
            <p className="text-sm font-semibold text-muted-foreground mb-1">💰 Lucro Líquido Final (após imposto no Japão)</p>
            <p className={`text-3xl font-bold ${jpTax.netProfitAfterTax >= 0 ? 'text-green-600' : 'text-red-600'}`}>{yen(jpTax.netProfitAfterTax)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceDetailManager;
