import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserCircle, Mail, Lock, Phone, ArrowRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/context/UserContext';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { register: registerUser, isAuthenticated } = useUser();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  // Test localStorage on mount
  React.useEffect(() => {
    console.log('🔍 [REGISTER DEBUG] Component mounted');
    console.log('🔍 [REGISTER DEBUG] Testing localStorage access...');
    
    try {
      // Test write
      localStorage.setItem('test-key', 'test-value');
      const testValue = localStorage.getItem('test-key');
      localStorage.removeItem('test-key');
      
      console.log('✅ [REGISTER DEBUG] localStorage is accessible:', testValue === 'test-value');
      
      // Check current users
      const usersData = localStorage.getItem('sweet-japan-users');
      if (usersData) {
        const users = JSON.parse(usersData);
        console.log('✅ [REGISTER DEBUG] Current users in storage:', Object.keys(users).length);
        console.log('✅ [REGISTER DEBUG] User emails:', Object.keys(users));
      } else {
        console.log('⚠️ [REGISTER DEBUG] No users in storage yet');
      }
    } catch (error) {
      console.error('❌ [REGISTER DEBUG] localStorage access error:', error);
    }
  }, []);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/perfil');
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🔍 [REGISTER DEBUG] ===== FORM SUBMIT START =====');
    console.log('🔍 [REGISTER DEBUG] Form data:', {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      hasPassword: !!formData.password,
      hasConfirmPassword: !!formData.confirmPassword
    });

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      console.log('❌ [REGISTER DEBUG] Passwords do not match');
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ [REGISTER DEBUG] Passwords match, calling registerUser...');

    try {
      // Register user
      const result = await registerUser({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        address: {
          postalCode: '',
          prefecture: '',
          city: '',
          address: '',
        }
      });

      console.log('🔍 [REGISTER DEBUG] registerUser returned:', result);

      if (result.success) {
        console.log('✅ [REGISTER DEBUG] Registration successful!');
        
        // Verify user was saved
        const usersData = localStorage.getItem('sweet-japan-users');
        if (usersData) {
          const users = JSON.parse(usersData);
          console.log('✅ [REGISTER DEBUG] Verification - User exists in storage:', !!users[formData.email]);
          console.log('✅ [REGISTER DEBUG] Total users in storage:', Object.keys(users).length);
        } else {
          console.error('❌ [REGISTER DEBUG] No users data in localStorage after registration!');
        }
        
        toast({
          title: "Cadastro realizado!",
          description: "Bem-vindo(a) ao Doce de Leite! Você ganhou um cupom de boas-vindas!",
        });

        // Redirect to profile
        setTimeout(() => {
          console.log('🔍 [REGISTER DEBUG] Redirecting to /perfil');
          navigate('/perfil');
        }, 1500);
      } else {
        console.log('❌ [REGISTER DEBUG] Registration failed - email already exists');
        toast({
          title: "Erro no cadastro",
          description: result.error || "Não foi possível criar sua conta. Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ [REGISTER DEBUG] Exception during registration:', error);
      toast({
        title: "Erro no cadastro",
        description: "Ocorreu um erro ao criar sua conta. Tente novamente.",
        variant: "destructive",
      });
    }

    console.log('🔍 [REGISTER DEBUG] ===== FORM SUBMIT END =====');
  };

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Criar Conta
            </h1>
            <p className="text-muted-foreground text-lg">
              Cadastre-se para acompanhar seus pedidos e receber ofertas exclusivas
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  Seus Dados
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <UserCircle className="w-4 h-4" />
                    Nome Completo *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="山田 太郎"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email *
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="exemplo@email.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Telefone *
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="090-1234-5678"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Senha *
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Confirmar Senha *
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    minLength={6}
                  />
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full btn-primary rounded-xl py-6 text-lg font-semibold"
                  >
                    Criar Conta
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>

                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    Já tem uma conta?{' '}
                    <Link to="/login" className="text-primary hover:underline font-medium">
                      Fazer login
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Register;
