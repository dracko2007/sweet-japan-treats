import React from 'react';
import Layout from '@/components/layout/Layout';
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
import CinematicPosterShelf from '@/components/home/CinematicPosterShelf';

const Index: React.FC = () => (
  <Layout>
    <CinematicHeroShelfTransition />

    <WelcomeCouponBanner />
    <ScrollReveal><CategoryQuickNav /></ScrollReveal>
    <CinematicPosterShelf
      i18nKey="posterShelf.shampoo"
      keywords={['shampoo', 'condicionador', 'tratamento capilar', 'hair']}
      wordmark="Shampoo"
    />

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

export default Index;
