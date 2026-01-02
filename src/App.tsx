import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/core/components/theme-provider"
import { analytics } from '@/core/lib/analytics';

import MainLayout from "@/core/layouts/MainLayout";
import NotFoundPage from "@/core/pages/NotFoundPage";

import HomePage from "@/core/pages/HomePage";
import GameStartPage from "@/core/pages/GameStartPage";
import ClearDataPage from "@/core/pages/ClearDataPage";
import AutoStartPage from "@/core/pages/AutoStartPage";
import AutoScoringPage from "@/core/pages/AutoScoringPage";
import TeleopScoringPage from "@/core/pages/TeleopScoringPage";
import EndgamePage from "@/core/pages/EndgamePage";
import { PitScoutingPage } from "@/core/pages/PitScoutingPage";
import APIDataPage from "@/core/pages/tba/APIDataPage";
import JSONDataTransferPage from "@/core/pages/JSONDataTransferPage";
// GAME-SPECIFIC: Uncomment and implement these in your game implementation
// import AutoStartPage from "@/pages/AutoStartPage";
// import ParseDataPage from "@/pages/ParseDataPage";
// import ClearDataPage from "@/pages/ClearDataPage";
// import QRDataTransferPage from "@/pages/QRDataTransferPage";
// import JSONDataTransferPage from "@/pages/JSONDataTransferPage";
// import MatchDataQRPage from "@/pages/MatchDataQRPage";
// import PeerTransferPage from "@/pages/PeerTransferPage";
// import MatchStrategyPage from "@/pages/MatchStrategyPage";
// import { AutoScoringPage, TeleopScoringPage } from "@/pages/ScoringPage";
// import EndgamePage from "@/pages/EndgamePage";
// import TeamStatsPage from "@/pages/TeamStatsPage";
// import PitScoutingPage from "@/pages/PitScoutingPage";
// import PitAssignmentsPage from "@/pages/PitAssignmentsPage";
// import PickListPage from "./pages/PickListPage";
// import StrategyOverviewPage from "./pages/StrategyOverviewPage";
// import ScoutManagementDashboardPage from "./pages/ScoutManagementDashboardPage";
// import AchievementsPage from "./pages/AchievementsPage";
// import DevUtilitiesPage from "./pages/DevUtilitiesPage";
// import { MatchValidationPage } from "./pages/MatchValidationPage";
import { InstallPrompt } from '@/core/components/pwa/InstallPrompt';
import { StatusBarSpacer } from '@/core/components/StatusBarSpacer';
import { SplashScreen } from '@/core/components/SplashScreen';
import { FullscreenProvider } from '@/core/contexts/FullscreenContext';
import { WebRTCProvider } from '@/core/contexts/WebRTCContext';
import { WebRTCDataRequestDialog } from '@/core/components/webrtc/WebRTCDataRequestDialog';
import { WebRTCPushedDataDialog } from '@/core/components/webrtc/WebRTCPushedDataDialog';
import { WebRTCNotifications } from '@/core/components/webrtc/WebRTCNotifications';



function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/game-start" element={<GameStartPage />} />
        <Route path="/auto-start" element={<AutoStartPage />} />
        <Route path="/auto-scoring" element={<AutoScoringPage />} />
        <Route path="/teleop-scoring" element={<TeleopScoringPage />} />
        <Route path="/endgame" element={<EndgamePage />} />
        <Route path="/clear-data" element={<ClearDataPage />} />
        <Route path="/pit-scouting" element={<PitScoutingPage />} />
        <Route path="/api-data" element={<APIDataPage />} />
        <Route path="/json-transfer" element={<JSONDataTransferPage />} />
        
        {/* GAME-SPECIFIC ROUTES: Uncomment and implement these in your game implementation */}
        {/* <Route path="/parse-data" element={<ParseDataPage />} /> */}
        {/* <Route path="/qr-data-transfer" element={<QRDataTransferPage />} /> */}
        {/* <Route path="/json-transfer" element={<JSONDataTransferPage />} /> */}
        {/* <Route path="/peer-transfer" element={<PeerTransferPage />} /> */}
        {/* <Route path="/match-data-qr" element={<MatchDataQRPage />} /> */}
        {/* <Route path="/match-strategy" element={<MatchStrategyPage />} /> */}
        {/* <Route path="/auto-scoring" element={<AutoScoringPage />} /> */}
        {/* <Route path="/teleop-scoring" element={<TeleopScoringPage />} /> */}
        {/* <Route path="/endgame" element={<EndgamePage />} /> */}
        {/* <Route path="/team-stats" element={<TeamStatsPage />} /> */}
        {/* <Route path="/pit-scouting" element={<PitScoutingPage />} /> */}
        {/* <Route path="/pit-assignments" element={<PitAssignmentsPage />} /> */}
        {/* <Route path="/strategy-overview" element={<StrategyOverviewPage />} /> */}
        {/* <Route path="/pick-list" element={<PickListPage />} /> */}
        {/* <Route path="/match-validation" element={<MatchValidationPage />} /> */}
        {/* <Route path="/scout-management" element={<ScoutManagementDashboardPage />} /> */}
        {/* <Route path="/achievements" element={<AchievementsPage />} /> */}
        {/* <Route path="/dev-utilities" element={<DevUtilitiesPage />} /> */}
        
        {/* Add more routes as needed */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    )
  );

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }

    // Track PWA install prompt
    window.addEventListener('beforeinstallprompt', () => {
      analytics.trackEvent('pwa_install_prompt_shown');
    });

    // Track if app was launched as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      analytics.trackPWALaunched();
    }

    // Debug analytics in development
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        analytics.debug();
        // Make analytics available globally for testing
        (window as typeof window & { analytics: typeof analytics }).analytics = analytics;
        
        // GAME-SPECIFIC: Uncomment these in your game implementation
        // Make achievement functions available globally for debugging
        // import('./lib/achievementUtils').then(achievementUtils => {
        //   (window as typeof window & { achievements: { backfillAll: () => Promise<void>, checkForNewAchievements: (name: string) => Promise<unknown[]> } }).achievements = {
        //     backfillAll: achievementUtils.backfillAchievementsForAllScouts,
        //     checkForNewAchievements: achievementUtils.checkForNewAchievements
        //   };
        // });

        // Make test data generator available globally for testing
        // import('./lib/testDataGenerator').then(testData => {
        //   (window as typeof window & { testData: { createTestProfiles: () => Promise<unknown>, clearAll: () => Promise<void> } }).testData = {
        //     createTestProfiles: testData.createTestScoutProfiles,
        //     clearAll: testData.clearTestData
        //   };
        //   console.log('🧪 Test data functions available:');
        //   console.log('  - window.testData.createTestProfiles() - Create test scout profiles');
        //   console.log('  - window.testData.clearAll() - Clear all scout data');
        // });

        // Make gameDB available for debugging
        // import('./lib/dexieDB').then(db => {
        //   (window as typeof window & { gameDB: typeof db.gameDB }).gameDB = db.gameDB;
        //   console.log('🗄️ Database available at window.gameDB');
        // });

        // Debug function to check scout data
        // (window as typeof window & { debugScoutData: (name: string) => Promise<void> }).debugScoutData = async (scoutName: string) => {
        //   const { gameDB } = await import('./lib/dexieDB');
        //   const scout = await gameDB.scouts.get(scoutName);
        //   console.log(`Scout data for ${scoutName}:`, scout);
        //   
        //   const achievements = await gameDB.scoutAchievements.where('scoutName').equals(scoutName).toArray();
        //   console.log(`Achievements for ${scoutName}:`, achievements);
        //   
        //   // Check specific stake achievements
        //   const { checkAchievement, ACHIEVEMENT_DEFINITIONS } = await import('./lib/achievementTypes');
        //   const stakeAchievements = ACHIEVEMENT_DEFINITIONS.filter(a => a.id.startsWith('stakes_'));
        //   
        //   stakeAchievements.forEach(achievement => {
        //     const isUnlocked = achievements.some(a => a.achievementId === achievement.id);
        //     const meetsRequirements = checkAchievement(achievement, scout!);
        //     console.log(`${achievement.name}: unlocked=${isUnlocked}, meetsReq=${meetsRequirements}, stakesFromPredictions=${scout?.stakesFromPredictions}`);
        //   });
        // };

        // console.log('🐛 Debug function available: window.debugScoutData("Riley Davis")');
      }, 2000);
    }

  }, []);
  
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <FullscreenProvider>
        <WebRTCProvider>
          <div className="min-h-screen bg-background">
            <RouterProvider router={router} />
            <InstallPrompt />
            <StatusBarSpacer />
            <WebRTCDataRequestDialog />
            <WebRTCPushedDataDialog />
            <WebRTCNotifications />
          </div>
        </WebRTCProvider>
      </FullscreenProvider>
    </ThemeProvider>
  );
}

export default App
