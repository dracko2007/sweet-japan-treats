import React, { useState, useEffect } from 'react';
import { X, Mail, Send, Users, CheckCircle, AlertCircle, Loader2, Package, Eye, Filter, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { customerService, CustomerStats } from '@/services/customerService';
import { productService } from '@/services/productService';
import { Product } from '@/types';

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;
const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL || 'onboarding@resend.dev';
const STORE_URL = 'https://japanexpress-store.com';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type Channel = 'email' | 'app' | 'both';
type GenderFilter = 'todos' | 'masculino' | 'feminino' | 'outro';

interface Props { onClose: () => void }

const PromoNotificationModal: React.FC<Props> = ({ onClose }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerStats[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Composer
  const [subject, setSubject] = useState('🌸 Oferta Especial - Japan Express');
  const [headline, setHeadline] = useState('Oferta imperdível para você!');
  const [extraMsg, setExtraMsg] = useState('Aproveite enquanto durar o estoque. Clique no botão abaixo para garantir o seu.');
  const [ctaLabel, setCtaLabel] = useState('Ver Oferta Agora');

  // Filters
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('todos');
  const [birthdayMonths, setBirthdayMonths] = useState<string[]>([]); // ["01","03"]
  const [channel, setChannel] = useState<Channel>('email');

  // Send state
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ email: string; ok: boolean }[]>([]);
  const [sent, setSent] = useState(false);
  const [tab, setTab] = useState<'compose' | 'preview'>('compose');

  useEffect(() => {
    setAllCustomers(customerService.getAllCustomers().filter(c => c.email?.includes('@')));
    productService.getMerged().then(list => setProducts(list.filter(p => !p.hidden)));
  }, []);

  // Apply filters
  const filtered = allCustomers.filter(c => {
    if (genderFilter !== 'todos' && c.gender !== genderFilter) return false;
    if (birthdayMonths.length > 0) {
      const month = c.birthdate?.slice(5, 7); // "YYYY-MM" → "MM"
      if (!month || !birthdayMonths.includes(month)) return false;
    }
    return true;
  });

  const toggleMonth = (m: string) =>
    setBirthdayMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const productUrl = selectedProduct ? `${STORE_URL}/produto/${selectedProduct.id}` : STORE_URL;
  const productPrice = selectedProduct
    ? (selectedProduct.variants?.length ? Math.min(...selectedProduct.variants.map(v => v.price)) : selectedProduct.prices.small)
    : null;
  const promoPrice = selectedProduct?.discountPercent && productPrice
    ? Math.round(productPrice * (1 - selectedProduct.discountPercent / 100))
    : null;

  const buildHtml = (name: string) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif}
    .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.1)}
    .header{background:linear-gradient(135deg,#e11d48,#9333ea);padding:28px 32px;text-align:center}
    .header h1{color:#fff;margin:0;font-size:24px}
    .header p{color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px}
    .body{padding:32px}
    .product-card{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:0 0 24px}
    .product-img{width:100%;max-height:280px;object-fit:cover;display:block}
    .product-info{padding:20px}
    .product-name{font-size:18px;font-weight:700;color:#111;margin:0 0 6px}
    .product-flavor{font-size:13px;color:#6b7280;margin:0 0 14px}
    .price-row{display:flex;align-items:baseline;gap:10px;margin:0 0 8px}
    .price-promo{font-size:26px;font-weight:800;color:#e11d48}
    .price-original{font-size:16px;color:#9ca3af;text-decoration:line-through}
    .price-normal{font-size:26px;font-weight:800;color:#111}
    .badge-off{background:#fef2f2;color:#e11d48;border:1px solid #fecaca;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700;display:inline-block}
    .extra{font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 24px}
    .cta{display:block;background:linear-gradient(135deg,#e11d48,#9333ea);color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:10px;font-size:16px;font-weight:700}
    .footer{background:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6}
    .footer a{color:#e11d48;text-decoration:none}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>🌸 Japan Express</h1>
      <p>Produtos importados direto do Japão</p>
    </div>
    <div class="body">
      <p style="font-size:17px;color:#111;margin:0 0 20px">Olá, <strong>${name}</strong>! 👋</p>
      <h2 style="font-size:20px;color:#111;margin:0 0 20px">${headline}</h2>
      ${selectedProduct ? `
      <div class="product-card">
        ${selectedProduct.thumbnail || selectedProduct.image
          ? `<img class="product-img" src="${selectedProduct.thumbnail || selectedProduct.image}" alt="${selectedProduct.name}">`
          : `<div style="background:#f9fafb;height:200px;display:flex;align-items:center;justify-content:center;font-size:48px">🛍️</div>`}
        <div class="product-info">
          <div class="product-name">${selectedProduct.name}</div>
          ${selectedProduct.flavor ? `<div class="product-flavor">${selectedProduct.flavor}</div>` : ''}
          <div class="price-row">
            ${promoPrice
              ? `<span class="price-promo">¥${promoPrice.toLocaleString()}</span><span class="price-original">¥${productPrice?.toLocaleString()}</span>`
              : `<span class="price-normal">¥${productPrice?.toLocaleString()}</span>`}
          </div>
          ${selectedProduct.discountPercent ? `<span class="badge-off">-${selectedProduct.discountPercent}% OFF</span>` : ''}
        </div>
      </div>` : ''}
      <p class="extra">${extraMsg}</p>
      <a class="cta" href="${productUrl}">${ctaLabel}</a>
    </div>
    <div class="footer">
      Japan Express · <a href="${STORE_URL}">japanexpress-store.com</a><br>
      <span style="font-size:11px;margin-top:6px;display:inline-block">Você está recebendo este e-mail por estar cadastrado em nossa loja.</span>
    </div>
  </div>
</body>
</html>`;

  const sendEmails = async () => {
    if (channel === 'app') {
      alert('Envio só pelo app requer configuração de VAPID keys / Firebase Cloud Messaging. Em desenvolvimento.');
      return;
    }
    if (!RESEND_API_KEY) { alert('VITE_RESEND_API_KEY não configurada no Vercel.'); return; }
    if (filtered.length === 0) { alert('Nenhum cliente corresponde ao filtro selecionado.'); return; }

    setSending(true);
    setResults([]);
    const partial: { email: string; ok: boolean }[] = [];

    for (const r of filtered) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({ from: FROM_EMAIL, to: r.email, subject, html: buildHtml(r.name) }),
        });
        partial.push({ email: r.email, ok: res.ok });
      } catch {
        partial.push({ email: r.email, ok: false });
      }
      setResults([...partial]);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setSending(false);
    setSent(true);
  };

  const successCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">Notificação Promocional</h2>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
              {filtered.length} destinatário{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab(tab === 'compose' ? 'preview' : 'compose')}
              className="flex items-center gap-1.5 text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-secondary transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              {tab === 'compose' ? 'Preview' : 'Editar'}
            </button>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'compose' ? (
            <div className="p-5 space-y-5">

              {/* ── FILTROS ─────────────────────────────── */}
              <div className="border border-border rounded-xl p-4 space-y-4 bg-secondary/20">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Filter className="w-4 h-4" /> Filtrar destinatários
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {allCustomers.length} cadastrados → <span className="text-primary font-semibold">{filtered.length} selecionados</span>
                  </span>
                </div>

                {/* Gênero */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">GÊNERO</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'todos', label: 'Todos' },
                      { value: 'feminino', label: '♀ Feminino' },
                      { value: 'masculino', label: '♂ Masculino' },
                      { value: 'outro', label: '— Outro / N/D' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setGenderFilter(opt.value as GenderFilter)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${genderFilter === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-gray-300'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Meses de aniversário */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    MÊS DE ANIVERSÁRIO <span className="font-normal">(vazio = ignorar)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MONTHS.map((m, i) => {
                      const val = String(i + 1).padStart(2, '0');
                      const active = birthdayMonths.includes(val);
                      return (
                        <button
                          key={val}
                          onClick={() => toggleMonth(val)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-gray-300'}`}
                        >
                          {m.slice(0, 3)}
                        </button>
                      );
                    })}
                    {birthdayMonths.length > 0 && (
                      <button onClick={() => setBirthdayMonths([])} className="px-2.5 py-1 rounded-lg border border-red-300 text-red-500 text-xs hover:bg-red-50">
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                {/* Canal */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">CANAL</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'email', label: '✉️ Só por e-mail' },
                      { value: 'app', label: '📲 Só no app' },
                      { value: 'both', label: '✉️📲 E-mail + App' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setChannel(opt.value as Channel)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${channel === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-gray-300'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {(channel === 'app' || channel === 'both') && (
                    <p className="text-xs text-amber-600 mt-1.5">⚠️ Push no app requer VAPID/FCM (em desenvolvimento). Apenas e-mail será enviado agora.</p>
                  )}
                </div>
              </div>

              {/* ── PRODUTO ─────────────────────────────── */}
              <div>
                <label className="block text-sm font-semibold mb-1 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" /> Produto em destaque
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <select
                  value={selectedProduct?.id || ''}
                  onChange={e => setSelectedProduct(products.find(p => p.id === e.target.value) || null)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Sem produto específico —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.discountPercent ? ` 🔥 -${p.discountPercent}%` : ''}
                    </option>
                  ))}
                </select>
                {selectedProduct && (
                  <div className="mt-2 flex items-center gap-3 p-2 bg-secondary/50 rounded-lg">
                    {(selectedProduct.thumbnail || selectedProduct.image) && (
                      <img src={selectedProduct.thumbnail || selectedProduct.image} className="w-12 h-12 object-cover rounded-lg shrink-0" alt="" />
                    )}
                    <div className="text-xs">
                      <div className="font-semibold">{selectedProduct.name}</div>
                      <div className="text-muted-foreground">
                        {promoPrice
                          ? <><span className="text-red-600 font-bold">¥{promoPrice.toLocaleString()}</span> <span className="line-through">¥{productPrice?.toLocaleString()}</span> <span className="text-red-600">-{selectedProduct.discountPercent}%</span></>
                          : <span>¥{productPrice?.toLocaleString()}</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── TEXTO ─────────────────────────────── */}
              <div>
                <label className="block text-sm font-semibold mb-1">Assunto do e-mail</label>
                <input value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Título principal</label>
                <input value={headline} onChange={e => setHeadline(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Texto da oferta</label>
                <textarea value={extraMsg} onChange={e => setExtraMsg(e.target.value)} rows={4}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-y" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Texto do botão</label>
                <input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>

              {/* Results */}
              {results.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-secondary px-3 py-2 text-sm font-semibold flex items-center justify-between">
                    <span>{successCount} enviados / {failCount} erro(s)</span>
                    {sent && <span className={successCount > 0 ? 'text-green-600' : 'text-red-600'}>{successCount > 0 ? '✓ Concluído' : '✗ Falhou'}</span>}
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-border">
                    {results.map(r => (
                      <div key={r.email} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        {r.ok ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        <span className="truncate">{r.email}</span>
                        <span className={`ml-auto ${r.ok ? 'text-green-600' : 'text-red-500'}`}>{r.ok ? 'ok' : 'erro'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-3 text-center">Preview do e-mail (nome de exemplo: "Maria")</p>
              <div className="border border-border rounded-xl overflow-hidden">
                <iframe srcDoc={buildHtml('Maria')} className="w-full" style={{ height: '560px', border: 'none' }} title="preview" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex gap-3 justify-end shrink-0">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={sendEmails} disabled={sending || sent || filtered.length === 0} className="gap-2">
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando {results.length}/{filtered.length}...</>
              : sent
                ? <><CheckCircle className="w-4 h-4" /> Concluído</>
                : <><Send className="w-4 h-4" /> Enviar para {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PromoNotificationModal;
