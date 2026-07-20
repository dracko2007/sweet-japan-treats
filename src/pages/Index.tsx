import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import PromoCarouselSection from '@/components/home/PromoCarouselSection';
import CategoryQuickNav from '@/components/home/CategoryQuickNav';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import RecentlyViewed from '@/components/home/RecentlyViewed';
import HomeVideos from '@/components/home/HomeVideos';
import ShippingBanner from '@/components/home/ShippingBanner';
import NewsletterSection from '@/components/home/NewsletterSection';
import AppDownloadSection from '@/components/AppDownloadSection';
import ScrollReveal from '@/components/ScrollReveal';
import WelcomeCouponBanner from '@/components/WelcomeCouponBanner';
import CinematicHeroShelfTransition from '@/components/home/CinematicHeroShelfTransition';

const Index: React.FC = () => {
  const [searchParams] = useSearchParams();
  const showTransitionHero = searchParams.get('hero') === 'transition';
  return (
    <Layout>
      {showTransitionHero && <CinematicHeroShelfTransition />}
      {/* Carrossel: loja + promoção ativa do admin + produtos em destaque */}
      <PromoCarouselSection />

      <WelcomeCouponBanner />
      <ScrollReveal><CategoryQuickNav /></ScrollReveal>

      {/* Most Viewed / Featured Products */}
      <ScrollReveal><FeaturedProducts /></ScrollReveal>

      {/* Recently Viewed */}
      <RecentlyViewed />

      {/* Videos */}
      <ScrollReveal><HomeVideos /></ScrollReveal>

      {/* Shipping Banner */}
      <ScrollReveal><ShippingBanner /></ScrollReveal>

      {/* Newsletter */}
      <ScrollReveal><NewsletterSection /></ScrollReveal>

      {/* App Download */}
      <ScrollReveal><AppDownloadSection /></ScrollReveal>
    </Layout>
  );
};

export default Index;
