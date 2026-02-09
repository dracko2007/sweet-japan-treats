import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserCircle, Mail, Lock, Phone, ArrowRight, MailCheck } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { register: registerUser, isAuthenticated } = useUser();
  const { t } = useLanguage();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

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

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
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

      if (result.success) {
        setRegistrationComplete(true);
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu email para confirmar sua conta.",
        });
      } else {
        toast({
          title: "Erro no cadastro",
          description: result.error || "Não foi possível criar sua conta. Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro no cadastro",
        description: "Ocorreu um erro ao criar sua conta. Tente novamente.",
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
              {registrationComplete ? t('auth.register.complete.title') : t('auth.register')}
            </h1>
            <p className="text-muted-foreground text-lg">
              {registrationComplete 
                ? t('auth.register.complete.subtitle')
                : t('auth.register.subtitle')}
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

              {/* Registration Complete - Email Verification Required */}
              {registrationComplete ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-6">
                    <MailCheck className="w-10 h-10 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="font-display text-2xl font-semibold text-foreground mb-3">
                    {t('auth.register.complete.confirm')}
                  </h2>
                  <p className="text-muted-foreground mb-2">
                    {t('auth.register.complete.sentTo')}
                  </p>
                  <p className="font-semibold text-primary text-lg mb-6">
                    {formData.email}
                  </p>
                  <Button 
                    className="w-full btn-primary rounded-xl py-6 text-lg font-semibold"
                    onClick={() => navigate('/login')}
                  >
                    {t('auth.register.complete.goLogin')}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              ) : (
                <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  {t('auth.register.title')}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <UserCircle className="w-4 h-4" />
                    {t('auth.register.name')}
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {t('auth.register.phone')}
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
                    {t('auth.register.password')}
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
                    {t('auth.register.confirmPassword')}
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
                    disabled={isLoading}
                    className="w-full btn-primary rounded-xl py-6 text-lg font-semibold"
                  >
                    {isLoading ? t('auth.register.loading') : t('auth.register.submit')}
                    {!isLoading && <ArrowRight className="w-5 h-5 ml-2" />}
                  </Button>
                </div>

                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('auth.register.hasAccount')}{' '}
                    <Link to="/login" className="text-primary hover:underline font-medium">
                      {t('auth.register.loginLink')}
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

export default Register;
