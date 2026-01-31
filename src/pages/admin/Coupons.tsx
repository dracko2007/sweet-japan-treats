import React, { useState } from 'react';
import { Ticket, Plus, Trash2, Calendar, Percent } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

interface CouponData {
  id: string;
  code: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  expiresAt: string;
  usageLimit: number;
  isActive: boolean;
}

const AdminCoupons: React.FC = () => {
  const [coupons, setCoupons] = useState<CouponData[]>([
    {
      id: '1',
      code: 'WELCOME10',
      discount: 500,
      discountType: 'fixed',
      expiresAt: '2026-12-31',
      usageLimit: 100,
      isActive: true
    },
    {
      id: '2',
      code: 'BIRTHDAY20',
      discount: 1000,
      discountType: 'fixed',
      expiresAt: '2026-12-31',
      usageLimit: 50,
      isActive: true
    }
  ]);

  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount: 0,
    discountType: 'fixed' as 'percentage' | 'fixed',
    expiresAt: '',
    usageLimit: 0
  });

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCoupon.code || newCoupon.discount <= 0) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const coupon: CouponData = {
      id: Date.now().toString(),
      ...newCoupon,
      isActive: true
    };

    setCoupons([...coupons, coupon]);
    setNewCoupon({
      code: '',
      discount: 0,
      discountType: 'fixed',
      expiresAt: '',
      usageLimit: 0
    });

    toast.success(`Cupom ${coupon.code} criado com sucesso!`);
  };

  const handleDeleteCoupon = (id: string) => {
    setCoupons(coupons.filter(c => c.id !== id));
    toast.info('Cupom removido');
  };

  const handleToggleCoupon = (id: string) => {
    setCoupons(coupons.map(c => 
      c.id === id ? { ...c, isActive: !c.isActive } : c
    ));
  };

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Gerenciar Cupons
            </h1>
            <p className="text-muted-foreground text-lg">
              Crie e gerencie cupons de desconto para seus clientes
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Create New Coupon */}
            <div className="bg-card rounded-2xl p-8 shadow-sm border border-border">
              <h2 className="font-semibold text-xl mb-6 flex items-center gap-2">
                <Plus className="w-6 h-6 text-primary" />
                Criar Novo Cupom
              </h2>

              <form onSubmit={handleCreateCoupon} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="code">Código do Cupom *</Label>
                    <Input
                      id="code"
                      value={newCoupon.code}
                      onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                      placeholder="Ex: SUMMER2026"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="discount">
                      <Percent className="w-4 h-4 inline mr-1" />
                      Valor do Desconto *
                    </Label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      value={newCoupon.discount || ''}
                      onChange={(e) => setNewCoupon({ ...newCoupon, discount: Number(e.target.value) })}
                      placeholder="500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Tipo de Desconto</Label>
                  <RadioGroup 
                    value={newCoupon.discountType} 
                    onValueChange={(val) => setNewCoupon({ ...newCoupon, discountType: val as 'percentage' | 'fixed' })}
                  >
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fixed" id="fixed" />
                        <Label htmlFor="fixed" className="cursor-pointer">Valor Fixo (¥)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="percentage" id="percentage" />
                        <Label htmlFor="percentage" className="cursor-pointer">Porcentagem (%)</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiresAt">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Data de Expiração
                    </Label>
                    <Input
                      id="expiresAt"
                      type="date"
                      value={newCoupon.expiresAt}
                      onChange={(e) => setNewCoupon({ ...newCoupon, expiresAt: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="usageLimit">Limite de Uso</Label>
                    <Input
                      id="usageLimit"
                      type="number"
                      min="0"
                      value={newCoupon.usageLimit || ''}
                      onChange={(e) => setNewCoupon({ ...newCoupon, usageLimit: Number(e.target.value) })}
                      placeholder="100"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Cupom
                </Button>
              </form>
            </div>

            {/* Existing Coupons */}
            <div className="bg-card rounded-2xl p-8 shadow-sm border border-border">
              <h2 className="font-semibold text-xl mb-6 flex items-center gap-2">
                <Ticket className="w-6 h-6 text-primary" />
                Cupons Existentes ({coupons.length})
              </h2>

              {coupons.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Ticket className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhum cupom cadastrado ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {coupons.map((coupon) => (
                    <div 
                      key={coupon.id} 
                      className={`p-4 rounded-xl border-2 transition-all ${
                        coupon.isActive 
                          ? 'border-primary/30 bg-primary/5' 
                          : 'border-border bg-secondary/20 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-xl font-bold text-primary">
                              {coupon.code}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              coupon.isActive 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}>
                              {coupon.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Desconto:</span>
                              <p className="font-medium">
                                {coupon.discountType === 'fixed' 
                                  ? `¥${coupon.discount}` 
                                  : `${coupon.discount}%`
                                }
                              </p>
                            </div>
                            {coupon.expiresAt && (
                              <div>
                                <span className="text-muted-foreground">Expira em:</span>
                                <p className="font-medium">
                                  {new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            )}
                            {coupon.usageLimit > 0 && (
                              <div>
                                <span className="text-muted-foreground">Limite:</span>
                                <p className="font-medium">{coupon.usageLimit} usos</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleCoupon(coupon.id)}
                          >
                            {coupon.isActive ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCoupon(coupon.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default AdminCoupons;
