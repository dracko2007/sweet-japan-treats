import React from 'react';
import Layout from '@/components/layout/Layout';
import HeroSection from '@/components/home/HeroSection';
import CategoryQuickNav from '@/components/home/CategoryQuickNav';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import RecentlyViewed from '@/components/home/RecentlyViewed';
import HomeVideos from '@/components/home/HomeVideos';
import ShippingBanner from '@/components/home/ShippingBanner';
import NewsletterSection from '@/components/home/NewsletterSection';
import AppDownloadSection from '@/components/AppDownloadSection';
import ScrollReveal from '@/components/ScrollReveal';
import { useLanguage } from '@/context/LanguageContext';
import FlagIcon from '@/components/FlagIcon';
import WelcomeCouponBanner from '@/components/WelcomeCouponBanner';

const Index: React.FC = () => {
  const { t } = useLanguage();

  return (
    <Layout>
      <HeroSection />
      <WelcomeCouponBanner />
      <ScrollReveal><CategoryQuickNav /></ScrollReveal>
      <ScrollReveal><FeaturedProducts /></ScrollReveal>
      <RecentlyViewed />
      <ScrollReveal><HomeVideos /></ScrollReveal>
      <ScrollReveal><ShippingBanner /></ScrollReveal>
      <ScrollReveal><NewsletterSection /></ScrollReveal>
      <ScrollReveal><AppDownloadSection /></ScrollReveal>

    </Layout>
  );
};

export default Index;
