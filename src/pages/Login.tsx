import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, UserCircle, KeyRound, MailCheck } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isAuthenticated, sendPasswordReset, isAdminAccount, loginAs, setLoginAs } = useUser();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  // Conta admin logada que ainda não escolheu o modo → mostra a tela de escolha
  const needsRoleChoice = isAuthenticated && isAdminAccount && !loginAs;

  React.useEffect(() => {
    if (!isAuthenticated) return;
    if (needsRoleChoice) return; // aguardando escolher Admin ou Cliente
    if (isAdminAccount) {
      navigate(loginAs === 'admin' ? '/admin' : '/');
    } else {
      navigate('/perfil');
    }
  }, [isAuthenticated, needsRoleChoice, isAdminAccount, loginAs, navigate]);

  // Só define o modo; o efeito acima cuida do redirecionamento
  const chooseAdmin = () => setLoginAs('admin');
  const chooseUser = () => setLoginAs('user');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        // Admin → tela de escolha (Admin/Cliente); cliente → o efeito redireciona
      } else {
        if (result.needsVerification) setNeedsVerification(true);
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
      toast({ title: "Erro", description: "Digite seu email.", variant: "destructive" });
      return;
    }
    setIsSendingReset(true);
    try {
      const result = await sendPasswordReset(forgotEmail);
      if (result.success) {
        toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada para redefinir sua senha." });
        setShowForgotPassword(false);
        setForgotEmail('');
      } else {
        toast({ title: "Erro", description: result.error || "Não foi possível enviar o email.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao enviar email de recuperação.", variant: "destructive" });
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
              {t('auth.login')}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t('auth.login.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
              
              {/* Language Switcher */}
              <div className="flex items-center justify-center gap-2 mb-6 pb-4 border-b border-border">
                <span className="text-sm text-muted-foreground mr-2">🌐</span>
                <LanguageSwitcher />
              </div>

              {needsRoleChoice ? (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <UserCircle className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-1">Como deseja entrar?</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Sua conta tem acesso de administrador. Escolha como quer usar o site agora.
                    <br />Para trocar depois, é só sair e entrar de novo.
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={chooseAdmin}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">🔐</div>
                      <div>
                        <p className="font-bold text-foreground">Administrador</p>
                        <p className="text-xs text-muted-foreground">Painel de gestão (pedidos, produtos, etc.)</p>
                      </div>
                    </button>
                    <button
                      onClick={chooseUser}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-gray-300 hover:bg-secondary/40 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-secondary text-foreground flex items-center justify-center shrink-0">🛍️</div>
                      <div>
                        <p className="font-bold text-foreground">Cliente</p>
                        <p className="text-xs text-muted-foreground">Navegar e comprar como um cliente normal</p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : showForgotPassword ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <KeyRound className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="font-display text-2xl font-semibold text-foreground">
                      Recuperar Senha
                    </h2>
                  </div>

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgotEmail" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {t('auth.login.email')}
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
                      <Button type="submit" className="w-full btn-primary rounded-xl py-6 text-lg font-semibold" disabled={isSendingReset}>
                        {isSendingReset ? 'Enviando...' : 'Enviar Link de Recuperação'}
                      </Button>
                      <Button type="button" variant="outline" className="w-full" onClick={() => setShowForgotPassword(false)}>
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
                      {t('auth.login.title')}
                    </h2>
                  </div>

                  {needsVerification && (
                    <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <MailCheck className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Email não verificado</p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                            Verifique sua caixa de entrada e clique no link de confirmação.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {t('auth.login.email')}
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
                        {t('auth.login.password')}
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
                      <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm text-primary hover:underline">
                        {t('auth.login.forgot')}
                      </button>
                    </div>

                    <div className="pt-2">
                      <Button type="submit" className="w-full btn-primary rounded-xl py-6 text-lg font-semibold" disabled={isLoading}>
                        {isLoading ? t('auth.login.loading') : t('auth.login.submit')}
                        {!isLoading && <ArrowRight className="w-5 h-5 ml-2" />}
                      </Button>
                    </div>

                    <div className="text-center pt-4">
                      <p className="text-sm text-muted-foreground">
                        {t('auth.login.noAccount')}{' '}
                        <Link to="/cadastro" className="text-primary hover:underline font-medium">
                          {t('auth.login.register')}
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
