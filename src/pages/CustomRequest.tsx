import React, { useState } from 'react';
import { PackagePlus, Send, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { customRequestService } from '@/services/customRequestService';

const COUNTRIES = ['Japão', 'Brasil', 'Portugal', 'França', 'Itália', 'Espanha'];

const CustomRequest: React.FC = () => {
  const { user } = useUser();
  const { selectedCountry } = useLanguage();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: user?.name || '',
    contact: user?.phone || user?.email || '',
    country: selectedCountry || 'Brasil',
    productDesc: '',
    referenceLink: '',
    quantity: '1',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.contact.trim() || !form.productDesc.trim()) {
      toast({ title: 'Preencha nome, contato e o que você quer', variant: 'destructive' });
      return;
    }
    setSending(true);
    const ok = await customRequestService.create({
      name: form.name.trim(),
      contact: form.contact.trim(),
      country: form.country,
      productDesc: form.productDesc.trim(),
      referenceLink: form.referenceLink.trim(),
      quantity: form.quantity.trim() || '1',
    });
    setSending(false);
    if (ok) {
      setSent(true);
      toast({ title: '✅ Pedido enviado!', description: 'Em breve entraremos em contato com o valor.' });
    } else {
      toast({ title: 'Não foi possível enviar', description: 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-semibold text-sm px-4 py-1.5 rounded-full mb-4">
            <PackagePlus className="w-4 h-4" /> Faça seu Pedido
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-3">
            Quer algo que não está na loja?
          </h1>
          <p className="text-muted-foreground text-lg">
            Diga o que você procura (qualquer produto do Japão) e nós cotamos o preço e o frete pra você. Sem compromisso! 🎌
          </p>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-2xl">
          {sent ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Pedido recebido! 🎉</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Vamos pesquisar o produto e te enviar o valor pelo contato que você informou.
              </p>
              <Button onClick={() => { setSent(false); set('productDesc', ''); set('referenceLink', ''); }} variant="outline" className="rounded-xl">
                Fazer outro pedido
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-card rounded-2xl border border-border p-6 lg:p-8 space-y-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/40 rounded-xl p-3">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                Ex: "Quero o álbum X do BTS", "tênis Asics modelo Y", "boneco do Luffy edição Z"...
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold block mb-1">Seu nome *</label>
                  <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Como te chamamos"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-1">WhatsApp ou e-mail *</label>
                  <input value={form.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Pra te enviar o valor"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold block mb-1">País de entrega</label>
                  <select value={form.country} onChange={(e) => set('country', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background">
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-1">Quantidade</label>
                  <input type="number" min={1} value={form.quantity} onChange={(e) => set('quantity', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold block mb-1">O que você quer? *</label>
                <textarea value={form.productDesc} onChange={(e) => set('productDesc', e.target.value)} rows={4}
                  placeholder="Descreva o produto: nome, marca, modelo, cor, tamanho..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background resize-y" />
              </div>

              <div>
                <label className="text-sm font-semibold block mb-1">Link de referência (opcional)</label>
                <input value={form.referenceLink} onChange={(e) => set('referenceLink', e.target.value)}
                  placeholder="Cole um link (Amazon Japão, Rakuten, foto...)"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background" />
              </div>

              <Button type="submit" disabled={sending} className="w-full btn-primary rounded-xl py-6 text-lg font-bold gap-2">
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {sending ? 'Enviando...' : 'Enviar pedido e pedir cotação'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Sem compromisso — você só paga se aceitar o valor que enviarmos.
              </p>
            </form>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default CustomRequest;
