import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Mail, Phone, Calendar, MapPin, Lock, Gift } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    birthday: '',
    prefecture: '',
    city: '',
    street: '',
    zipCode: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    // Mock registration - in real app, this would call an API
    console.log('Registration data:', formData);
    
    // In a real app, this would:
    // 1. Create user account
    // 2. Send welcome email with coupon
    // 3. Set up birthday reminder
    
    toast.success('Cadastro realizado com sucesso! Enviamos um cupom de boas-vindas para seu email.');
  };

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Criar Conta
            </h1>
            <p className="text-muted-foreground text-lg">
              Cadastre-se e ganhe cupons de desconto exclusivos!
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            {/* Benefits */}
            <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-6 mb-8 border border-primary/20">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary" />
                Benefícios do Cadastro
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Cupom de boas-vindas no seu email
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Cupom especial no seu aniversário
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Ofertas e promoções exclusivas
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Acompanhamento fácil dos seus pedidos
                </li>
              </ul>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-8 shadow-sm border border-border">
              <div className="space-y-6">
                {/* Personal Information */}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Informações Pessoais
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nome completo *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="Seu nome"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email">
                          <Mail className="w-4 h-4 inline mr-1" />
                          Email *
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          placeholder="seu@email.com"
                        />
                      </div>

                      <div>
                        <Label htmlFor="phone">
                          <Phone className="w-4 h-4 inline mr-1" />
                          Telefone *
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          required
                          placeholder="090-1234-5678"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="birthday">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Data de Nascimento (para cupom de aniversário)
                      </Label>
                      <Input
                        id="birthday"
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Endereço (opcional)
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="zipCode">CEP (〒)</Label>
                        <Input
                          id="zipCode"
                          value={formData.zipCode}
                          onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                          placeholder="123-4567"
                        />
                      </div>

                      <div>
                        <Label htmlFor="prefecture">Prefeitura</Label>
                        <Input
                          id="prefecture"
                          value={formData.prefecture}
                          onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                          placeholder="Tokyo, Osaka, etc."
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Cidade"
                      />
                    </div>

                    <div>
                      <Label htmlFor="street">Endereço completo</Label>
                      <Input
                        id="street"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        placeholder="Rua, número, apartamento"
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Senha
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="password">Senha *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">Confirmar senha *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                        placeholder="Digite a senha novamente"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <Button type="submit" className="w-full btn-primary py-6 text-lg font-semibold">
                  Criar Conta
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Já tem uma conta?{' '}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    Faça login
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Register;
