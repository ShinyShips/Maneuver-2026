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
import APIDataPage from "@/core/pages/APIDataPage";
import JSONDataTransferPage from "@/core/pages/JSONDataTransferPage";
import PeerTransferPage from "@/core/pages/PeerTransferPage";
import QRDataTransferPage from "@/core/pages/QRDataTransferPage";
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
import TeamStatsPage from "@/core/pages/TeamStatsPage";
import StrategyOverviewPage from "@/core/pages/StrategyOverviewPage";
import MatchStrategyPage from "@/core/pages/MatchStrategyPage";
import PickListPage from "@/core/pages/PickListPage";
// import PitScoutingPage from "@/pages/PitScoutingPage";
import ScoutManagementDashboardPage from "@/core/pages/ScoutManagementDashboardPage";
import AchievementsPage from "@/core/pages/AchievementsPage";
import DevUtilitiesPage from "@/core/pages/DevUtilitiesPage";
import { MatchValidationPage } from "@/core/pages/MatchValidationPage";
import PitAssignmentsPage from "@/core/pages/PitAssignmentsPage";
import { InstallPrompt } from '@/core/components/pwa/InstallPrompt';
import { PWAUpdatePrompt } from '@/core/components/pwa/PWAUpdatePrompt';
import { StatusBarSpacer } from '@/core/components/StatusBarSpacer';
import { SplashScreen } from '@/core/components/SplashScreen';
import { FullscreenProvider } from '@/core/contexts/FullscreenContext';
import { WebRTCProvider } from '@/core/contexts/WebRTCContext';
import { ScoutProvider } from '@/core/contexts/ScoutContext';
import { WebRTCDataRequestDialog } from '@/core/components/webrtc/WebRTCDataRequestDialog';
import { WebRTCPushedDataDialog } from '@/core/components/webrtc/WebRTCPushedDataDialog';
import { WebRTCNotifications } from '@/core/components/webrtc/WebRTCNotifications';
import { GameProvider } from "@/core/contexts/GameContext";
import { strategyAnalysis } from "@/game-template/analysis";
import { scoringCalculations } from "@/game-template/scoring";
import { gameDataTransformation } from "@/game-template/transformation";
import {
  StatusToggles,
  GameSpecificQuestions,
  GameSpecificScoutOptions,
} from "@/game-template/components";
import logo from "../src/assets/Maneuver Wordmark Vertical.png";
import { generateDemoEvent, generateDemoEventScheduleOnly } from "@/core/lib/demoDataGenerator";
import { generate2026GameData } from "@/game-template/demoDataGenerator2026";
import { db, pitDB, gameDB } from "@/db";
import { clearEventCache, clearEventValidationResults, getCachedTBAEventMatches } from "@/core/lib/tbaCache";

// Mock implementations for missing template parts
const mockConfig = { year: 2026, gameName: "REBUILT", scoring: { auto: {}, teleop: {}, endgame: {} } };
const mockValidation = { getDataCategories: () => [], calculateAllianceStats: () => ({}), calculateAllianceScore: () => ({ auto: 0, teleop: 0, endgame: 0, total: 0 }), validateMatch: async () => ({} as any), getDefaultConfig: () => ({} as any) };
const mockUI = { GameStartScreen: () => null, AutoScoringScreen: () => null, TeleopScoringScreen: () => null };

// Demo data handlers
const DEMO_EVENT_KEY = 'demo2026';

const loadDemoData = async () => {
  console.log('🎲 Loading demo data...');
  
  // Generate comprehensive demo data
  await generateDemoEvent({
    eventKey: DEMO_EVENT_KEY,
    clearExisting: true,
    gameDataGenerator: generate2026GameData,
    includePlayoffs: true,
    seedFakeValidationResults: false,
  });
  
  // Update local storage for demo event
  localStorage.setItem('eventName', DEMO_EVENT_KEY);
  
  const eventsList = JSON.parse(localStorage.getItem('eventsList') || '[]');
  if (!eventsList.includes(DEMO_EVENT_KEY)) {
    eventsList.push(DEMO_EVENT_KEY);
    localStorage.setItem('eventsList', JSON.stringify(eventsList));
  }
  
  // Update scouts list
  const scouts = await gameDB.scouts.toArray();
  const scoutNames = scouts.map(s => s.name).sort();
  localStorage.setItem('scoutsList', JSON.stringify(scoutNames));
  
  console.log('✅ Demo data loaded successfully!');
};

const loadDemoScheduleOnly = async () => {
  console.log('🗓️ Loading demo schedule only...');

  await generateDemoEventScheduleOnly({
    eventKey: DEMO_EVENT_KEY,
    clearExisting: true,
  });

  localStorage.setItem('eventName', DEMO_EVENT_KEY);

  const eventsList = JSON.parse(localStorage.getItem('eventsList') || '[]');
  if (!eventsList.includes(DEMO_EVENT_KEY)) {
    eventsList.push(DEMO_EVENT_KEY);
    localStorage.setItem('eventsList', JSON.stringify(eventsList));
  }

  console.log('✅ Demo schedule loaded successfully!');
};

const clearDemoData = async () => {
  console.log('🗑️ Clearing demo data...');
  
  // Clear all demo data from databases
  await db.scoutingData.where('eventKey').equals(DEMO_EVENT_KEY).delete();
  await pitDB.pitScoutingData.where('eventKey').equals(DEMO_EVENT_KEY).delete();
  await gameDB.scouts.clear();
  await gameDB.predictions.where('eventKey').equals(DEMO_EVENT_KEY).delete();
  await gameDB.scoutAchievements.clear();
  await clearEventCache(DEMO_EVENT_KEY);
  await clearEventValidationResults(DEMO_EVENT_KEY);
  
  // Clear from local storage
  const eventsList = JSON.parse(localStorage.getItem('eventsList') || '[]');
  const filtered = eventsList.filter((e: string) => e !== DEMO_EVENT_KEY);
  localStorage.setItem('eventsList', JSON.stringify(filtered));
  
  if (localStorage.getItem('eventName') === DEMO_EVENT_KEY) {
    localStorage.removeItem('eventName');
  }

  if (localStorage.getItem('eventKey') === DEMO_EVENT_KEY) {
    localStorage.removeItem('eventKey');
  }

  const customEvents = JSON.parse(localStorage.getItem('customEventsList') || '[]');
  const filteredCustomEvents = customEvents.filter((e: string) => e !== DEMO_EVENT_KEY);
  localStorage.setItem('customEventsList', JSON.stringify(filteredCustomEvents));

  localStorage.removeItem('matchData');
  
  console.log('✅ Demo data cleared successfully!');
};

const checkDemoData = async (): Promise<boolean> => {
  const entryCount = await db.scoutingData.where('eventKey').equals(DEMO_EVENT_KEY).count();
  const cachedMatches = await getCachedTBAEventMatches(DEMO_EVENT_KEY);
  return entryCount > 0 || cachedMatches.length > 0;
};

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route
        path="/"
        element={
          <GameProvider
            config={mockConfig as any}
            scoring={scoringCalculations as any}
            validation={mockValidation as any}
            analysis={strategyAnalysis as any}
            transformation={gameDataTransformation as any}
            ui={{
              ...mockUI,
              StatusToggles,
              PitScoutingQuestions: GameSpecificQuestions,
              ScoutOptionsContent: GameSpecificScoutOptions,
            } as any}
          >
            <MainLayout />
          </GameProvider>
        }
      >
        <Route 
          index 
          element={
            <HomePage 
              logo={logo} 
              appName="Maneuver 2026"
              version="2026.0.8"
              onLoadDemoData={loadDemoData}
              onLoadDemoScheduleOnly={loadDemoScheduleOnly}
              onClearData={clearDemoData}
              checkExistingData={checkDemoData}
              demoDataDescription="Load sample data for 30 teams, 60 matches, 8 scouts with predictions, and pit scouting to explore all features"
              demoDataStats="Demo data loaded! 30 teams, 60 matches, 8 scouts"
              demoScheduleStats="Demo schedule loaded! 30 teams, 60 matches"
            />
          } 
        />
        <Route path="/game-start" element={<GameStartPage />} />
        <Route path="/auto-start" element={<AutoStartPage />} />
        <Route path="/auto-scoring" element={<AutoScoringPage />} />
        <Route path="/teleop-scoring" element={<TeleopScoringPage />} />
        <Route path="/endgame" element={<EndgamePage />} />
        <Route path="/clear-data" element={<ClearDataPage />} />
        <Route path="/pit-scouting" element={<PitScoutingPage />} />
        <Route path="/api-data" element={<APIDataPage />} />
        <Route path="/json-transfer" element={<JSONDataTransferPage />} />
        <Route path="/peer-transfer" element={<PeerTransferPage />} />
        <Route path="/qr-transfer" element={<QRDataTransferPage />} />

        {/* GAME-SPECIFIC ROUTES: Uncomment and implement these in your game implementation */}
        {/* <Route path="/parse-data" element={<ParseDataPage />} /> */}
        {/* <Route path="/json-transfer" element={<JSONDataTransferPage />} /> */}
        {/* <Route path="/peer-transfer" element={<PeerTransferPage />} /> */}
        {/* <Route path="/match-data-qr" element={<MatchDataQRPage />} /> */}
        {/* <Route path="/match-strategy" element={<MatchStrategyPage />} /> */}
        {/* <Route path="/auto-scoring" element={<AutoScoringPage />} /> */}
        {/* <Route path="/teleop-scoring" element={<TeleopScoringPage />} /> */}
        {/* <Route path="/endgame" element={<EndgamePage />} /> */}
        <Route path="/team-stats" element={<TeamStatsPage />} />
        <Route path="/strategy-overview" element={<StrategyOverviewPage />} />
        <Route path="/match-strategy" element={<MatchStrategyPage />} />
        <Route path="/pick-list" element={<PickListPage />} />
        {/* <Route path="/pit-scouting" element={<PitScoutingPage />} />  */}
        <Route path="/scout-management" element={<ScoutManagementDashboardPage />} />
        <Route path="/pit-assignments" element={<PitAssignmentsPage />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="/match-validation" element={<MatchValidationPage />} />
        <Route path="/dev-utilities" element={<DevUtilitiesPage />} />


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

        // Make achievement functions available globally for debugging
        import('@/core/lib/achievementUtils').then(achievementUtils => {
          (window as any).achievements = {
            backfillAll: achievementUtils.backfillAchievementsForAllScouts
          };
        });

        // Make test data generator available globally for testing
        import('@/core/lib/testDataGenerator').then(testData => {
          (window as any).dev = {
            seedData: () => testData.generateRandomScoutingData(30),
            seedScouts: testData.generateRandomScouts,
            resetDB: testData.resetEntireDatabase
          };
          console.log('🧪 Dev utilities available on window.dev');
        });

        // Make databases available for debugging
        import('@/db').then(db => {
          (window as any).dbs = {
            main: db.db,
            pit: db.pitDB,
            game: db.gameDB
          };
          console.log('🗄️ Databases available at window.dbs');
        });
      }, 2000);
    }

  }, []);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ScoutProvider>
        <FullscreenProvider>
          <WebRTCProvider>
            <div className="min-h-screen bg-background">
              <RouterProvider router={router} />
              <InstallPrompt />
              <PWAUpdatePrompt />
              <StatusBarSpacer />
              <WebRTCDataRequestDialog />
              <WebRTCPushedDataDialog />
              <WebRTCNotifications />
            </div>
          </WebRTCProvider>
        </FullscreenProvider>
      </ScoutProvider>
    </ThemeProvider>
  );
}

export default App
