import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, UserCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/context/UserContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isAuthenticated } = useUser();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        toast({
          title: "Login realizado!",
          description: "Bem-vindo(a) de volta!",
        });

        // Redirect to profile
        setTimeout(() => {
          navigate('/perfil');
        }, 1000);
      } else {
        toast({
          title: "Erro ao fazer login",
          description: result.error || "Email ou senha incorretos. Verifique seus dados ou cadastre-se.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao fazer login. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Fazer Login
            </h1>
            <p className="text-muted-foreground text-lg">
              Entre na sua conta para acompanhar seus pedidos
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
                  Entrar na Conta
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    disabled={isLoading}
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
                    disabled={isLoading}
                  />
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full btn-primary rounded-xl py-6 text-lg font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Entrando...' : 'Entrar'}
                    {!isLoading && <ArrowRight className="w-5 h-5 ml-2" />}
                  </Button>
                </div>

                <div className="text-center pt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Não tem uma conta?{' '}
                    <Link to="/cadastro" className="text-primary hover:underline font-medium">
                      Cadastre-se
                    </Link>
                  </p>
                  
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      💡 <strong>Dica:</strong> Se você já se cadastrou mas não consegue fazer login,
                      tente se cadastrar novamente. Seu cadastro anterior pode não ter sido salvo corretamente.
                    </p>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Login;
