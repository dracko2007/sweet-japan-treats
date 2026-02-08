import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, UserCircle, KeyRound, MailCheck } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/context/UserContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isAuthenticated, sendPasswordReset } = useUser();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

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
    setNeedsVerification(false);

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        toast({
          title: "Login realizado!",
          description: "Bem-vindo(a) de volta!",
        });
        setTimeout(() => {
          navigate('/perfil');
        }, 1000);
      } else {
        if (result.needsVerification) {
          setNeedsVerification(true);
        }
        toast({
          title: "Erro ao fazer login",
          description: result.error || "Email ou senha incorretos.",
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast({
        title: "Erro",
        description: "Digite seu email.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingReset(true);
    try {
      const result = await sendPasswordReset(forgotEmail);
      if (result.success) {
        toast({
          title: "Email enviado!",
          description: "Verifique sua caixa de entrada para redefinir sua senha.",
        });
        setShowForgotPassword(false);
        setForgotEmail('');
      } else {
        toast({
          title: "Erro",
          description: result.error || "Não foi possível enviar o email.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao enviar email de recuperação.",
        variant: "destructive",
      });
    } finally {
      setIsSendingReset(false);
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
              
              {/* Forgot Password Form */}
              {showForgotPassword ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <KeyRound className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="font-display text-2xl font-semibold text-foreground">
                      Recuperar Senha
                    </h2>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    Digite seu email e enviaremos um link para redefinir sua senha.
                  </p>

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgotEmail" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email *
                      </Label>
                      <Input
                        id="forgotEmail"
                        type="email"
                        placeholder="exemplo@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        disabled={isSendingReset}
                      />
                    </div>

                    <div className="pt-4 space-y-3">
                      <Button 
                        type="submit" 
                        className="w-full btn-primary rounded-xl py-6 text-lg font-semibold"
                        disabled={isSendingReset}
                      >
                        {isSendingReset ? 'Enviando...' : 'Enviar Link de Recuperação'}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowForgotPassword(false)}
                      >
                        Voltar ao Login
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="font-display text-2xl font-semibold text-foreground">
                      Entrar na Conta
                    </h2>
                  </div>

                  {/* Email Verification Banner */}
                  {needsVerification && (
                    <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <MailCheck className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            Email não verificado
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                            Verifique sua caixa de entrada (e pasta de spam) e clique no link de confirmação que enviamos quando você se cadastrou.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

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

                    <div className="text-right">
                      <button 
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-primary hover:underline"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>

                    <div className="pt-2">
                      <Button 
                        type="submit" 
                        className="w-full btn-primary rounded-xl py-6 text-lg font-semibold"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Entrando...' : 'Entrar'}
                        {!isLoading && <ArrowRight className="w-5 h-5 ml-2" />}
                      </Button>
                    </div>

                    <div className="text-center pt-4">
                      <p className="text-sm text-muted-foreground">
                        Não tem uma conta?{' '}
                        <Link to="/cadastro" className="text-primary hover:underline font-medium">
                          Cadastre-se
                        </Link>
                      </p>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Login;
