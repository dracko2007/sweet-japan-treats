import React from 'react';
import { Heart, Star, Users, Award, MessageCircle, MapPin } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useLanguage } from '@/context/LanguageContext';

const About: React.FC = () => {
  const { t } = useLanguage();

  const values = [
    { icon: Heart, titleKey: 'aboutPage.value1.title', descKey: 'aboutPage.value1.desc' },
    { icon: Star, titleKey: 'aboutPage.value2.title', descKey: 'aboutPage.value2.desc' },
    { icon: Users, titleKey: 'aboutPage.value3.title', descKey: 'aboutPage.value3.desc' },
    { icon: Award, titleKey: 'aboutPage.value4.title', descKey: 'aboutPage.value4.desc' },
  ];

  return (
    <Layout>
      {/* Hero — Quem Somos */}
      <div className="gradient-hero py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Foto */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                <div className="w-72 h-72 sm:w-80 sm:h-80 lg:w-96 lg:h-96 rounded-3xl overflow-hidden shadow-elevated">
                  <img
                    src="/paula-shiokawa.jpg"
                    alt="Paula Shiokawa — Japan Express"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="absolute -bottom-5 -left-5 bg-card rounded-2xl shadow-card px-4 py-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-foreground">Hiroshima, Japão 🇯🇵</span>
                </div>
              </div>
            </div>

            {/* Texto */}
            <div className="order-first lg:order-last space-y-5">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                Sua Conexão Direta com o Japão
              </span>
              <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                Mais do que uma loja, somos uma ponte entre o Japão e você.
              </h1>
              <p className="text-muted-foreground leading-relaxed">
                A Japan Express nasceu da paixão por conectar pessoas aos melhores produtos, tendências e experiências do Japão e da Coreia. Localizados em Hiroshima, oferecemos compras personalizadas, redirecionamento de encomendas e envios internacionais com segurança, transparência e atendimento dedicado.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Selecionamos cuidadosamente cosméticos, produtos de skincare, alimentos, suplementos, itens exclusivos e lançamentos diretamente das principais lojas japonesas e coreanas, garantindo autenticidade, qualidade e confiança em cada pedido.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Nosso compromisso é tornar sua experiência simples e segura, acompanhando cada etapa do processo, desde a busca pelo produto ideal até a entrega em seu destino.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Acreditamos que a distância não deve ser um obstáculo para quem deseja ter acesso ao melhor que o Japão oferece.
              </p>
              <p className="font-display font-semibold text-foreground">
                Japan Express — aproximando você da qualidade, inovação e cultura japonesa, onde quer que você esteja.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Values */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-4">
              {t('aboutPage.valuesTitle')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('aboutPage.valuesSubtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <div key={value.titleKey} className="p-6 rounded-2xl bg-background border border-border text-center">
                <div className="w-14 h-14 rounded-full gradient-caramel flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {t(value.titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(value.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 gradient-caramel text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-bold mb-4">
            {t('aboutPage.ctaTitle')}
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
            {t('aboutPage.ctaDesc')}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/produtos"
              className="px-8 py-3 bg-background text-foreground rounded-full font-semibold hover:bg-background/90 transition-colors"
            >
              {t('aboutPage.ctaProducts')}
            </a>
            <a
              href="mailto:contato@japanexpress-store.com"
              className="px-8 py-3 border-2 border-primary-foreground rounded-full font-semibold hover:bg-primary-foreground/10 transition-colors"
            >
              {t('aboutPage.ctaContact')}
            </a>
            <a
              href="https://wa.me/817013671679"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-green-500 text-white rounded-full font-semibold hover:bg-green-600 transition-colors inline-flex items-center gap-2"
            >
              <MessageCircle className="w-5 h-5" /> WhatsApp
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
