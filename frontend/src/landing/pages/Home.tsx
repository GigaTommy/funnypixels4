import React from 'react';
import Navigation from '../components/Navigation';
import HeroEnhanced from '../components/HeroEnhanced';
import FeaturesEnhanced from '../components/FeaturesEnhanced';
import HowItWorks from '../components/HowItWorks';
import Screenshots from '../components/Screenshots';
import Testimonials from '../components/Testimonials';
import DownloadCTA from '../components/DownloadCTA';
import Footer from '../components/Footer';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroEnhanced />
      <FeaturesEnhanced />
      <HowItWorks />
      <Screenshots />
      <Testimonials />
      <DownloadCTA />
      <Footer />
    </div>
  );
};

export default Home;
