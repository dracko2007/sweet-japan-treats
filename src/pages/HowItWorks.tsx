import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, CreditCard, Plane, Landmark, Truck, Home,
  Smartphone, Search, QrCode, Wallet, Globe2, Copy, Check,
  ArrowRight, MapPin, Bell, Percent, ShieldCheck, Clock,
  Building2, ChevronDown, FileText, BadgeCheck, Briefcase,
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════
   "Como Funciona" — jornada do pedido, pagamento, impostos e rastreio,
   com desenhos interativos (SVG animado + passos clicáveis).
   ════════════════════════════════════════════════════════════════ */

// ---------- 1. JORNADA DO PEDIDO (stepper interativo) ----------
const JOURNEY = [
  {
    icon: Package, color: '#ec4899', title: 'Você faz o pedido',
    desc: 'Escolhe os produtos no catálogo e fecha o carrinho. Pode ser produto pronto ou um "Faça seu Pedido" personalizado.',
  },
  {
    icon: CreditCard, color: '#f59e0b', title: 'Pagamento',
    desc: 'Você paga por PIX (Brasil), PayPay (Japão) ou Wise (internacional). Só preparamos o pacote depois do pagamento confirmado.',
  },
  {
    icon: Package, color: '#8b5cf6', title: 'Preparo em Hiroshima',
    desc: 'Separamos e embalamos tudo com carinho na nossa loja no Japão, com proteção extra para a viagem.',
  },
  {
    icon: Plane, color: '#3b82f6', title: 'Envio aéreo / marítimo',
    desc: 'O pacote viaja do Japão até o seu país pela transportadora escolhida (EMS, Correios, Yamato, navio...).',
  },
  {
    icon: Landmark, color: '#ef4444', title: 'Alfândega & impostos',
    desc: 'Na chegada, a Receita Federal fiscaliza o pacote. Se houver imposto, você recebe a notificação e paga online (app/site dos Correios) ANTES da liberação — nunca em dinheiro ao carteiro.',
  },
  {
    icon: Truck, color: '#22c55e', title: 'Correios entrega',
    desc: 'Os Correios do seu país assumem a última etapa. Você acompanha tudo pelo código de rastreio.',
  },
  {
    icon: Home, color: '#0ea5e9', title: 'Chega na sua casa 🎉',
    desc: 'Você recebe na porta (ou retira na agência, se preferir). Pronto — um pedacinho do Japão chegou!',
  },
];

const JourneyStepper: React.FC = () => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Avança sozinho devagar; ao clicar num passo, para para a pessoa ler com calma.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % JOURNEY.length), 6000);
    return () => clearInterval(id);
  }, [paused]);

  const pick = (i: number) => { setActive(i); setPaused(true); };

  const Cur = JOURNEY[active];
  const pct = (active / (JOURNEY.length - 1)) * 100;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-8 shadow-sm">
      {/* Trilha com o pacote viajando */}
      <div className="relative mb-8 pt-6">
        {/* linha de fundo */}
        <div className="absolute left-0 right-0 top-[42px] h-1.5 bg-secondary rounded-full" />
        {/* linha preenchida */}
        <div
          className="absolute left-0 top-[42px] h-1.5 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#ec4899,#f59e0b)' }}
        />
        {/* pacote voando sobre a linha */}
        <div
          className="absolute -top-1 transition-all duration-700 ease-out z-10"
          style={{ left: `calc(${pct}% - 16px)` }}
        >
          <div className="w-9 h-9 rounded-full bg-white shadow-lg border-2 flex items-center justify-center animate-bounce"
            style={{ borderColor: Cur.color }}>
            <Plane className="w-4 h-4" style={{ color: Cur.color }} />
          </div>
        </div>

        {/* bolinhas dos passos */}
        <div className="flex justify-between relative">
          {JOURNEY.map((s, i) => {
            const Ico = s.icon;
            const done = i <= active;
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                className="flex flex-col items-center gap-2 group"
                style={{ width: `${100 / JOURNEY.length}%` }}
              >
                <span
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-300 shrink-0',
                    done ? 'scale-100' : 'scale-90 opacity-50',
                    i === active && 'ring-4 ring-offset-2 ring-offset-card'
                  )}
                  style={{
                    background: done ? s.color : 'var(--secondary, #f1f5f9)',
                    borderColor: s.color,
                    color: done ? '#fff' : s.color,
                    boxShadow: i === active ? `0 0 0 4px ${s.color}33` : undefined,
                  }}
                >
                  <Ico className="w-5 h-5" />
                </span>
                <span className={cn(
                  'text-[10px] sm:text-xs font-semibold text-center leading-tight hidden sm:block transition-colors',
                  i === active ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Painel do passo ativo */}
      <div key={active} className="animate-fade-up flex items-start gap-4 bg-secondary/40 rounded-xl p-5 border border-border/60">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${Cur.color}1a` }}>
          <Cur.icon className="w-6 h-6" style={{ color: Cur.color }} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: Cur.color }}>
            Passo {active + 1} de {JOURNEY.length}
          </p>
          <h3 className="font-bold text-lg text-foreground mb-1">{Cur.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{Cur.desc}</p>
        </div>
      </div>
      <div className="text-center mt-3">
        {paused ? (
          <button onClick={() => setPaused(false)} className="text-[11px] font-semibold text-primary hover:underline">
            ⏸️ Pausado — toque para voltar a avançar automaticamente
          </button>
        ) : (
          <p className="text-[11px] text-muted-foreground">👆 Toque em uma etapa para pausar e ler com calma</p>
        )}
      </div>
    </div>
  );
};

// ---------- 2. FORMAS DE PAGAMENTO (cartões interativos) ----------
const PAYMENTS = [
  {
    id: 'pix', icon: QrCode, color: '#22c55e', label: 'PIX', tag: 'Brasil 🇧🇷',
    short: 'Pagamento instantâneo com QR Code ou código copia-e-cola.',
    steps: [
      'No checkout, escolha PIX.',
      'Abra o app do seu banco e escaneie o QR Code (ou cole o código).',
      'Confirme o valor exato e pague.',
      'O pagamento é identificado automaticamente e seu pedido entra em preparo.',
    ],
  },
  {
    id: 'paypay', icon: Wallet, color: '#ef4444', label: 'PayPay', tag: 'Japão 🇯🇵',
    short: 'Carteira digital mais usada no Japão, via QR Code.',
    steps: [
      'No checkout, escolha PayPay.',
      'Abra o app PayPay e toque em "Scan".',
      'Escaneie o QR Code da Japan Express.',
      'Digite o valor exato e confirme o pagamento.',
    ],
  },
  {
    id: 'wise', icon: Globe2, color: '#3b82f6', label: 'Wise', tag: 'Internacional 🌍',
    short: 'Transferência internacional barata (Europa e outros países).',
    steps: [
      'No checkout, escolha Wise.',
      'Você recebe um link de cobrança Wise (ou Wisetag).',
      'Abra o link e pague na sua moeda local (EUR, USD...).',
      'Nos envie o comprovante e confirmamos o preparo.',
    ],
  },
];

const PaymentMethods: React.FC = () => {
  const [open, setOpen] = useState('pix');
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {PAYMENTS.map((p) => {
        const Ico = p.icon;
        const isOpen = open === p.id;
        return (
          <button
            key={p.id}
            onClick={() => setOpen(p.id)}
            className={cn(
              'text-left rounded-2xl border p-5 transition-all duration-300',
              isOpen ? 'shadow-lg scale-[1.02] bg-card' : 'bg-card/60 hover:bg-card'
            )}
            style={{ borderColor: isOpen ? p.color : undefined }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${p.color}1a` }}>
                <Ico className="w-6 h-6" style={{ color: p.color }} />
              </span>
              <div>
                <h4 className="font-bold text-foreground leading-none">{p.label}</h4>
                <span className="text-[11px] text-muted-foreground">{p.tag}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{p.short}</p>

            <div className={cn('overflow-hidden transition-all duration-500', isOpen ? 'max-h-72' : 'max-h-0')}>
              <ol className="space-y-2 pt-2 border-t border-border">
                {p.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-xs text-foreground">
                    <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: p.color }}>{i + 1}</span>
                    <span className="leading-snug text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
            {!isOpen && <span className="text-[11px] font-semibold" style={{ color: p.color }}>Ver passo a passo →</span>}
          </button>
        );
      })}
    </div>
  );
};

// ---------- 3. IMPOSTOS (explicador por país) ----------
const TAX = {
  Brasil: {
    flag: '🇧🇷', tone: '#f59e0b',
    headline: 'Quem cobra é a Receita Federal (Remessa Conforme)',
    rows: [
      ['Compras até US$ 50', '20% Imposto de Importação + 17% ICMS'],
      ['De US$ 50 a US$ 3.000', '60% (− US$ 20 de desconto) + 17% ICMS'],
    ],
    note: 'Os Correios apenas entregam — quem tributa é a Receita Federal. Você é avisado pelo app/e-mail/SMS dos Correios e paga online (Pix, cartão ou boleto) ANTES da liberação. Nunca se paga em dinheiro ao carteiro. ⚠️ Cuidado com links falsos: confirme sempre no app oficial ou em correios.com.br.',
  },
  Europa: {
    flag: '🇪🇺', tone: '#3b82f6',
    headline: 'IVA + taxa postal local, pagos na entrega',
    rows: [
      ['No site (checkout)', '€ 0,00 de imposto'],
      ['Na alfândega local', 'IVA do país (20–23%) + taxa postal'],
    ],
    note: 'Enviamos via remessa postal internacional. O IVA e a taxa dos correios locais (CTT, La Poste...) são cobrados na entrega.',
  },
  Japão: {
    flag: '🇯🇵', tone: '#22c55e',
    headline: 'Envio nacional — sem imposto de importação',
    rows: [
      ['Imposto de importação', 'Isento (¥0)'],
      ['Consumo (Shouhizei 10%)', 'Já incluso no preço'],
    ],
    note: 'Despachado de Hiroshima dentro do Japão: nenhum trâmite alfandegário. Frete grátis acima de ¥6.000.',
  },
} as const;

type TaxKey = keyof typeof TAX;

const TaxExplainer: React.FC = () => {
  const [c, setC] = useState<TaxKey>('Brasil');
  const t = TAX[c];
  return (
    <div className="bg-card rounded-2xl border border-border p-5 sm:p-7 shadow-sm">
      {/* toggle país */}
      <div className="flex gap-2 mb-5">
        {(Object.keys(TAX) as TaxKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setC(k)}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all',
              c === k ? 'text-white shadow' : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
            )}
            style={{ background: c === k ? TAX[k].tone : undefined, borderColor: c === k ? TAX[k].tone : 'transparent' }}
          >
            {TAX[k].flag} {k}
          </button>
        ))}
      </div>

      {/* fluxo visual produto → alfândega → você */}
      <div className="flex items-center justify-between gap-2 mb-5">
        {[
          { ic: Package, lb: 'Produto + frete', sub: 'pago no site' },
          { ic: Landmark, lb: 'Receita Federal', sub: 'fiscaliza e calcula' },
          { ic: Smartphone, lb: 'Você', sub: 'paga online p/ liberar' },
        ].map((s, i, arr) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center text-center gap-1.5 flex-1">
              <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: `${t.tone}1a` }}>
                <s.ic className="w-5 h-5" style={{ color: t.tone }} />
              </span>
              <span className="text-[11px] font-bold text-foreground leading-none">{s.lb}</span>
              <span className="text-[10px] text-muted-foreground">{s.sub}</span>
            </div>
            {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <div key={c} className="animate-fade-up rounded-xl p-4 border" style={{ background: `${t.tone}0d`, borderColor: `${t.tone}33` }}>
        <p className="font-bold text-foreground flex items-center gap-2 mb-3">
          <Percent className="w-4 h-4" style={{ color: t.tone }} /> {t.headline}
        </p>
        <div className="space-y-2 mb-3">
          {t.rows.map(([a, b], i) => (
            <div key={i} className="flex justify-between items-center text-xs gap-3 border-b border-border/50 pb-2 last:border-0">
              <span className="text-muted-foreground">{a}</span>
              <span className="font-bold text-foreground text-right" style={{ color: t.tone }}>{b}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed bg-background/60 rounded-lg p-2.5">
          ⚠️ {t.note}
        </p>
      </div>
    </div>
  );
};

// ---------- 4. APP CORREIOS + RASTREAMENTO (mockup de celular) ----------
const TRACK_STATES = [
  { ic: Package, lb: 'Objeto postado', sub: 'Hiroshima, Japão', color: '#ec4899' },
  { ic: Plane, lb: 'Em trânsito internacional', sub: 'Voo para o Brasil', color: '#3b82f6' },
  { ic: Landmark, lb: 'Fiscalização aduaneira', sub: 'Aguardando liberação', color: '#ef4444' },
  { ic: Truck, lb: 'Saiu para entrega', sub: 'Sua cidade', color: '#f59e0b' },
  { ic: Home, lb: 'Objeto entregue 🎉', sub: 'Recebido', color: '#22c55e' },
];

const CorreiosTracking: React.FC = () => {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const fakeCode = 'LB123456789JP';

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setStep((s) => (s + 1) % (TRACK_STATES.length + 1)), 3500);
    return () => clearInterval(id);
  }, [paused]);

  const copy = () => {
    navigator.clipboard?.writeText(fakeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-center">
      {/* Mockup de celular */}
      <div className="flex flex-col items-center">
        <div
          onClick={() => setPaused((p) => !p)}
          title="Toque para pausar/continuar"
          className="w-[270px] rounded-[2.2rem] border-[10px] border-foreground/90 bg-background shadow-2xl overflow-hidden cursor-pointer select-none">
          {/* notch */}
          <div className="h-6 bg-foreground/90 flex items-center justify-center">
            <div className="w-16 h-1.5 bg-background/40 rounded-full" />
          </div>
          {/* topo do app */}
          <div className="px-4 py-3 text-white flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#facc15,#eab308)' }}>
            <span className="w-7 h-7 rounded-md bg-white/20 flex items-center justify-center">📮</span>
            <span className="font-bold text-sm">App Correios</span>
          </div>
          {/* campo de busca */}
          <div className="p-3">
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-2.5 py-2 mb-3">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-mono text-foreground tracking-wide">{fakeCode}</span>
            </div>
            {/* timeline */}
            <div className="space-y-0">
              {TRACK_STATES.map((s, i) => {
                const reached = i < step;
                const current = i === step - 1;
                const Ico = s.ic;
                return (
                  <div key={i} className="flex gap-2.5 items-start">
                    <div className="flex flex-col items-center">
                      <span className={cn('w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500',
                        current && 'ring-4', reached ? '' : 'opacity-30')}
                        style={{ background: reached ? s.color : '#cbd5e1', boxShadow: current ? `0 0 0 3px ${s.color}44` : undefined }}>
                        <Ico className="w-3 h-3 text-white" />
                      </span>
                      {i < TRACK_STATES.length - 1 && (
                        <span className="w-0.5 h-5 transition-colors duration-500" style={{ background: reached ? s.color : '#e2e8f0' }} />
                      )}
                    </div>
                    <div className={cn('pb-1 transition-opacity duration-500', reached ? 'opacity-100' : 'opacity-40')}>
                      <p className="text-[11px] font-bold text-foreground leading-tight">{s.lb}</p>
                      <p className="text-[9px] text-muted-foreground">{s.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <button onClick={() => setPaused((p) => !p)} className="text-[11px] font-semibold text-primary hover:underline mt-3">
          {paused ? '⏸️ Pausado — toque para continuar' : '👆 Toque no celular para pausar'}
        </button>
      </div>

      {/* Instruções */}
      <div>
        <h3 className="font-bold text-xl text-foreground mb-3 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" /> Acompanhe pelo app dos Correios
        </h3>
        <ol className="space-y-3 mb-5">
          {[
            ['Baixe o app "Correios"', 'Disponível na App Store (iOS) e Google Play (Android).'],
            ['Copie o código de rastreio', 'Enviamos por mensagem assim que o pacote é postado no Japão.'],
            ['Cole na busca do app', 'Toque em "Rastrear" e veja cada etapa em tempo real.'],
            ['Ative as notificações', 'O app avisa quando o pacote sai para entrega ou chega na agência.'],
          ].map(([t, d], i) => (
            <li key={i} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <div>
                <p className="font-semibold text-sm text-foreground">{t}</p>
                <p className="text-xs text-muted-foreground">{d}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
          <Button onClick={copy} variant="outline" className="gap-2 justify-center min-w-0 flex-1 sm:flex-none">
            {copied ? <Check className="w-4 h-4 text-green-600 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
            <span className="truncate">{copied ? 'Código copiado!' : 'Copiar código de exemplo'}</span>
          </Button>
          <Button asChild className="btn-primary gap-2 justify-center min-w-0 flex-1 sm:flex-none">
            <Link to="/rastrear"><MapPin className="w-4 h-4 shrink-0" /> <span className="truncate">Rastrear meu pedido</span></Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 bg-secondary/40 rounded-lg p-3">
          <Bell className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          Dica: fora do Brasil, use o app/site dos correios do seu país (CTT, La Poste, Japan Post...) com o mesmo código de rastreio internacional.
        </p>
      </div>
    </div>
  );
};

// ---------- 4b. IMPORTAÇÃO PARA EMPRESAS (banner expansível) ----------
const BIZ_STEPS = [
  { ic: BadgeCheck, t: 'Habilitação no Radar / Siscomex', d: 'A empresa precisa do Radar (Registro e Rastreamento da Atuação dos Intervenientes Aduaneiros) habilitado na Receita Federal para operar no Siscomex — o sistema oficial de comércio exterior.' },
  { ic: Briefcase, t: 'Despachante aduaneiro', d: 'Um despachante registra a operação e cuida da documentação. Para grandes volumes/valores, é praticamente obrigatório.' },
  { ic: FileText, t: 'Declaração de Importação (DI)', d: 'A importação formal é registrada via DI no Siscomex, com a classificação fiscal (NCM) de cada produto e o valor aduaneiro.' },
  { ic: Percent, t: 'Tributação completa', d: 'Em vez do regime simplificado, incidem II + IPI + PIS/COFINS-Importação + ICMS, conforme a NCM. Pode somar bem mais que os 60% do regime de pessoa física.' },
];

const BusinessImport: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-primary/5 transition-colors"
      >
        <span className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6 text-primary" />
        </span>
        <div className="flex-1">
          <h3 className="font-bold text-foreground">Você é empresa? Importação em grande volume</h3>
          <p className="text-xs text-muted-foreground">
            Acima de US$ 3.000 por remessa, ou compras para revenda, seguem outro caminho — clique para entender.
          </p>
        </div>
        <ChevronDown className={cn('w-5 h-5 text-primary shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      <div className={cn('transition-all duration-500 overflow-hidden', open ? 'max-h-[700px]' : 'max-h-0')}>
        <div className="px-5 pb-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed bg-background/60 rounded-xl p-3 border border-border">
            O regime simplificado (Remessa Conforme — app dos Correios) vale para pessoa física, até <strong>US$ 3.000</strong> por remessa.
            Acima disso, ou para mercadoria de revenda, a operação é uma <strong>importação formal</strong> com regras próprias:
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {BIZ_STEPS.map((s) => (
              <div key={s.t} className="bg-background rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <s.ic className="w-4 h-4 text-primary shrink-0" />
                  <h4 className="font-bold text-sm text-foreground">{s.t}</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ⚠️ A notificação e o pagamento <strong>não</strong> chegam pelo app dos Correios como nas compras comuns — tudo passa pelo Siscomex e pelo despachante. Os prazos e custos também são diferentes.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild className="btn-primary gap-2">
              <Link to="/empresas"><Building2 className="w-4 h-4" /> Falar sobre pedido empresarial</Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/faca-seu-pedido">Solicitar cotação personalizada</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- 5. COMO RETIRAR / RECEBER ----------
const PICKUP = [
  { ic: Home, color: '#22c55e', t: 'Entrega em casa', d: 'Depois de liberado (e do imposto pago online, se houver), o carteiro entrega no endereço do pedido. O pagamento de tributos é sempre feito antes, pelo app — nunca em dinheiro na porta.' },
  { ic: MapPin, color: '#3b82f6', t: 'Retirar na agência', d: 'Se ninguém estiver em casa, o pacote fica numa agência dos Correios perto de você para retirada com documento.' },
  { ic: ShieldCheck, color: '#8b5cf6', t: 'Confira e assine', d: 'Confira a embalagem na entrega. Em caso de avaria, registre e nos avise — ajudamos com a transportadora.' },
];

// ---------- PÁGINA ----------
const HowItWorks: React.FC = () => {
  return (
    <Layout>
      {/* Hero */}
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Como Funciona
          </h1>
          <p className="text-muted-foreground text-lg">
            Do pagamento à sua porta: pagamento, retirada, impostos e rastreamento — explicados com desenhos interativos.
          </p>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-5xl space-y-16">

          {/* 1. Jornada */}
          <div>
            <header className="mb-5 text-center">
              <h2 className="font-display text-2xl font-bold text-foreground">A jornada do seu pedido</h2>
              <p className="text-sm text-muted-foreground">Acompanhe cada etapa, do Japão até a sua casa.</p>
            </header>
            <JourneyStepper />
          </div>

          {/* 2. Pagamento */}
          <div>
            <header className="mb-5 text-center">
              <h2 className="font-display text-2xl font-bold text-foreground flex items-center justify-center gap-2">
                <CreditCard className="w-6 h-6 text-primary" /> Formas de pagamento
              </h2>
              <p className="text-sm text-muted-foreground">Escolha um cartão para ver o passo a passo.</p>
            </header>
            <PaymentMethods />
          </div>

          {/* 3. Impostos */}
          <div>
            <header className="mb-5 text-center">
              <h2 className="font-display text-2xl font-bold text-foreground flex items-center justify-center gap-2">
                <Landmark className="w-6 h-6 text-primary" /> Como funciona a cobrança de impostos
              </h2>
              <p className="text-sm text-muted-foreground">Selecione o destino para entender o que é cobrado e quando.</p>
            </header>
            <TaxExplainer />
            <p className="text-center text-xs text-muted-foreground mt-3">
              Quer simular o valor exato? Use a <Link to="/frete" className="text-primary font-semibold hover:underline">página de Frete</Link>.
            </p>
            <div className="mt-5">
              <BusinessImport />
            </div>
          </div>

          {/* 4. Como retirar */}
          <div>
            <header className="mb-5 text-center">
              <h2 className="font-display text-2xl font-bold text-foreground flex items-center justify-center gap-2">
                <Truck className="w-6 h-6 text-primary" /> Como retirar / receber
              </h2>
            </header>
            <div className="grid md:grid-cols-3 gap-4">
              {PICKUP.map((p) => (
                <div key={p.t} className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
                  <span className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: `${p.color}1a` }}>
                    <p.ic className="w-6 h-6" style={{ color: p.color }} />
                  </span>
                  <h4 className="font-bold text-foreground mb-1">{p.t}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Rastreamento */}
          <div>
            <header className="mb-5 text-center">
              <h2 className="font-display text-2xl font-bold text-foreground flex items-center justify-center gap-2">
                <Search className="w-6 h-6 text-primary" /> App dos Correios & rastreamento
              </h2>
            </header>
            <div className="bg-card rounded-2xl border border-border p-5 sm:p-8 shadow-sm">
              <CorreiosTracking />
            </div>
          </div>

          {/* CTA final */}
          <div className="text-center bg-primary/5 border border-primary/20 rounded-2xl p-8">
            <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-display text-xl font-bold text-foreground mb-2">Pronto para começar?</h3>
            <p className="text-sm text-muted-foreground mb-4">Escolha seus produtos e acompanhe tudo até a sua porta.</p>
            <Button asChild className="btn-primary gap-2">
              <Link to="/produtos">Ver catálogo <ArrowRight className="w-4 h-4" /></Link>
            </Button>
          </div>

        </div>
      </section>
    </Layout>
  );
};

export default HowItWorks;
