import React from 'react';
import Layout from '@/components/layout/Layout';
import HeroSection from '@/components/home/HeroSection';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import HomeVideos from '@/components/home/HomeVideos';
import ShippingBanner from '@/components/home/ShippingBanner';
import AppDownloadSection from '@/components/AppDownloadSection';
import { useLanguage } from '@/context/LanguageContext';
import FlagIcon from '@/components/FlagIcon';
import WelcomeCouponBanner from '@/components/WelcomeCouponBanner';

const Index: React.FC = () => {
  const { t } = useLanguage();

  return (
    <Layout>
      <HeroSection />
      <WelcomeCouponBanner />
      <FeaturedProducts />
      <HomeVideos />
      <ShippingBanner />
      <AppDownloadSection />


    </Layout>
  );
};

export default Index;
