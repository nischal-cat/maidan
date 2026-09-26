import { useNavigate } from 'react-router-dom';
import { Hero } from '../components/home/Hero';
import { CourtsSection } from '../components/home/CourtsSection';
import { NextMatchBand } from '../components/home/NextMatchBand';
import { TrustColumns } from '../components/home/TrustColumns';
import { ResumeDraftBanner } from '../components/home/HomeExtras';
import {
  RecentlyAddedRail,
  PlayedRecentlyRail,
  SuggestedRail,
} from '../components/home/GroundRails';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <main>
        <NextMatchBand />
        <ResumeDraftBanner />
        <RecentlyAddedRail />
        <CourtsSection onBook={(id) => navigate(`/grounds/${id}`)} />
        <PlayedRecentlyRail />
        <SuggestedRail />
        <TrustColumns />
      </main>
    </div>
  );
}