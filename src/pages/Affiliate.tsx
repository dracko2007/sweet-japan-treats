import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Link2, Copy, Check, DollarSign, Package, TrendingUp, Percent } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { affiliateService, Affiliate } from '@/services/affiliateService';

const SITE_URL = 'https://japan-express.vercel.app';

const AffiliatePage: React.FC = () => {
  const { user, isAuthenticated } = useUser();
  const { toast } = useToast();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    affiliateService.getByOwnerEmail(user.email).then((list) => {
      setAffiliates(list);
      setLoading(false);
    });
  }, [user?.email]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast({ title: 'Copiado!', description: text });
    setTimeout(() => setCopied(null), 2000);
  };

  const yen = (v: number) => `¥${(v || 0).toLocaleString()}`;

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-semibold text-sm px-4 py-1.5 rounded-full mb-4">
            <Megaphone className="w-4 h-4" /> Programa de Afiliados
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-3">
            Painel do Influencer
          </h1>
          <p className="text-muted-foreground text-lg">
            Acompanhe suas indicações e comissões
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
              {affiliates.map((aff) => {
                const link = `${SITE_URL}/?ref=${aff.code}`;
                const expired = new Date(aff.expiresAt) < new Date();
                return (
                  <div key={aff.code} className="bg-card rounded-2xl border border-border p-6 lg:p-8 space-y-6">
                    {/* Header com código */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase font-bold text-muted-foreground">Seu código</p>
                        <p className="font-display text-3xl font-extrabold text-primary font-mono">{aff.code}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${aff.active && !expired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {expired ? 'Expirado' : aff.active ? 'Ativo' : 'Inativo'}
                      </span>
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
                        <p className="text-xl font-bold">{aff.totalOrders || 0}</p>
                      </div>
                      <div className="bg-secondary/30 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><TrendingUp className="w-3 h-3" /> Receita gerada</p>
                        <p className="text-xl font-bold">{yen(aff.totalRevenue)}</p>
                      </div>
                      <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
                        <p className="text-xs text-primary flex items-center gap-1 mb-1"><DollarSign className="w-3 h-3" /> Sua comissão</p>
                        <p className="text-xl font-bold text-primary">{yen(aff.totalEarnings)}</p>
                        <p className="text-[10px] text-muted-foreground">{aff.commissionPercent}% das vendas</p>
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default AffiliatePage;
