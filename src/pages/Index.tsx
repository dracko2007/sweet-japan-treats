import React from 'react';
import Layout from '@/components/layout/Layout';
import CategoryQuickNav from '@/components/home/CategoryQuickNav';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import RecentlyViewed from '@/components/home/RecentlyViewed';
import HomeVideos from '@/components/home/HomeVideos';
import ShippingBanner from '@/components/home/ShippingBanner';
import ScrollReveal from '@/components/ScrollReveal';
import WelcomeCouponBanner from '@/components/WelcomeCouponBanner';
import CinematicHeroShelfTransition from '@/components/home/CinematicHeroShelfTransition';
import CinematicPosterShelf from '@/components/home/CinematicPosterShelf';

const Index: React.FC = () => (
  <Layout>
    <CinematicHeroShelfTransition />

    <WelcomeCouponBanner />
    <ScrollReveal><CategoryQuickNav /></ScrollReveal>
    {/* Mais vistos / ofertas logo depois da vitrine: a grade de produtos não pode ficar no fim da rolagem */}
    <ScrollReveal><FeaturedProducts /></ScrollReveal>

    <CinematicPosterShelf
      i18nKey="posterShelf.shampoo"
      keywords={['shampoo', 'condicionador', 'tratamento capilar', 'hair']}
      wordmark="Shampoo"
    />

    {/* Recently Viewed */}
    <RecentlyViewed />

    {/* Videos */}
    <ScrollReveal><HomeVideos /></ScrollReveal>

    {/* Frete + newsletter (uma seção: a newsletter sozinha era uma faixa de meia tela).
        O app continua em 'Instalar o App' no rodapé e no InstallPrompt. */}
    <ScrollReveal><ShippingBanner /></ScrollReveal>
  </Layout>
);

export default Index;
