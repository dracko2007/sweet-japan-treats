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
import { isValidEmail, isValidPhone, isNonEmpty, maskPhone, runValidations, FieldErrors } from '@/utils/validation';

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
  const [whatsappMarketing, setWhatsappMarketing] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/perfil');
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Aplica máscara no telefone enquanto digita
    const nextValue = name === 'phone' ? maskPhone(value) : value;
    setFormData(prev => ({
      ...prev,
      [name]: nextValue
    }));
    // Limpa o erro do campo ao editar
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const fieldErrors = runValidations({
      name: () => (isNonEmpty(formData.name, 2) ? null : 'Informe seu nome completo.'),
      email: () => (isValidEmail(formData.email) ? null : 'E-mail inválido.'),
      phone: () => (isValidPhone(formData.phone) ? null : 'Telefone inválido (10–11 dígitos).'),
      password: () => (formData.password.length >= 6 ? null : 'A senha deve ter ao menos 6 caracteres.'),
      confirmPassword: () =>
        formData.password === formData.confirmPassword ? null : 'As senhas não coincidem.',
    });
    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: 'Confira os campos',
        description: 'Alguns dados precisam de correção.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await registerUser({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        whatsappMarketing: whatsappMarketing,
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

        // Send automatic welcome message if opted in
        if (whatsappMarketing && formData.phone) {
          const welcomeMsg = `*SAKURA EXPRESS* 🌸\n\nOlá, *${formData.name}*!\nObrigado por se cadastrar em nossa loja!\n\n🎟️ Aqui está o seu cupom de boas-vindas: *SAKURA90* (dá *90% de desconto* em todo o site!).\n\n🔥 *Novidades fresquinhas do Japão:*\n• Protetor solar Bioré UV Aqua Rich com frete aéreo expresso grátis para o Brasil.\n• Snacks e cosméticos exclusivos direto do Japão!\n\nAcesse nossa loja: https://japan-express.vercel.app`;
          
          import('@/services/whatsappService').then(({ whatsappService }) => {
            whatsappService.sendMessage({
              to: formData.phone,
              message: welcomeMsg
            });
          });
        }
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
                    aria-invalid={!!errors.name}
                    className={errors.name ? 'border-destructive' : ''}
                    required
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
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
                    aria-invalid={!!errors.email}
                    className={errors.email ? 'border-destructive' : ''}
                    required
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
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
                    aria-invalid={!!errors.phone}
                    className={errors.phone ? 'border-destructive' : ''}
                    maxLength={13}
                    required
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
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
                    aria-invalid={!!errors.confirmPassword}
                    className={errors.confirmPassword ? 'border-destructive' : ''}
                    required
                    minLength={6}
                  />
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                </div>

                <div className="flex items-start gap-2.5 pt-1">
                  <input
                    id="whatsappMarketing"
                    name="whatsappMarketing"
                    type="checkbox"
                    checked={whatsappMarketing}
                    onChange={(e) => setWhatsappMarketing(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-input text-primary focus:ring-primary"
                  />
                  <Label htmlFor="whatsappMarketing" className="text-xs text-muted-foreground cursor-pointer select-none leading-tight">
                    Quero receber cupons de desconto (como o de 90% OFF) e novidades do Japão diretamente no meu WhatsApp.
                  </Label>
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
