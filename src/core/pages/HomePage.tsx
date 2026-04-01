import { cn } from "@/core/lib/utils";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/core/components/ui/alert-dialog";
import { DataAttribution } from "@/core/components/DataAttribution";
import { useState, useEffect } from "react";
import { analytics } from '@/core/lib/analytics';
import { haptics } from '@/core/lib/haptics';

/**
 * HomePage Props
 * Game implementations can provide their own logo, version, and demo data handlers
 */
interface HomePageProps {
  logo?: string;
  appName?: string;
  version?: string;
  onLoadDemoData?: () => Promise<void>;
  onLoadDemoScheduleOnly?: () => Promise<void>;
  onClearData?: () => Promise<void>;
  checkExistingData?: () => Promise<boolean>;
  demoDataDescription?: string;
  demoDataStats?: string;
  demoScheduleStats?: string;
}


const HomePage = ({
  logo,
  appName = "Maneuver",
  version = "2026.5.0",
  onLoadDemoData,
  onLoadDemoScheduleOnly,
  onClearData,
  checkExistingData,
  demoDataDescription = "Load sample scouting data to explore the app's features",
  demoDataStats = "Demo data loaded successfully!",
  demoScheduleStats = "Demo schedule loaded successfully!"
}: HomePageProps = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadedType, setLoadedType] = useState<'demo' | 'schedule'>('demo');
  const [loadingType, setLoadingType] = useState<'demo' | 'schedule' | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<'demo' | 'schedule' | null>(null);

  useEffect(() => {
    const checkData = async () => {
      if (checkExistingData) {
        try {
          const hasData = await checkExistingData();
          setIsLoaded(hasData);
        } catch (error) {
          console.error("Error checking existing data:", error);
        }
      }
    };

    checkData();

    const handleDataChanged = () => {
      void checkData();
    };

    window.addEventListener('dataChanged', handleDataChanged);
    window.addEventListener('allDataCleared', handleDataChanged);

    return () => {
      window.removeEventListener('dataChanged', handleDataChanged);
      window.removeEventListener('allDataCleared', handleDataChanged);
    };
  }, [checkExistingData]);

  const loadDemoData = async () => {
    if (!onLoadDemoData) return;

    haptics.medium();
    setIsLoading(true);
    setLoadingType('demo');

    try {
      await onLoadDemoData();
      setIsLoaded(true);
      setLoadedType('demo');
      haptics.success();
      analytics.trackEvent('demo_data_loaded');
    } catch (error) {
      haptics.error();
      console.error("HomePage - Error loading demo data:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);
      }
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const loadDemoScheduleOnly = async () => {
    if (!onLoadDemoScheduleOnly) return;

    haptics.medium();
    setIsLoading(true);
    setLoadingType('schedule');

    try {
      await onLoadDemoScheduleOnly();
      setIsLoaded(true);
      setLoadedType('schedule');
      haptics.success();
      analytics.trackEvent('demo_schedule_loaded');
    } catch (error) {
      haptics.error();
      console.error("HomePage - Error loading demo schedule:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);
      }
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const clearData = async () => {
    if (!onClearData) return;

    haptics.medium();

    try {
      await onClearData();
      setIsLoaded(false);
      analytics.trackEvent('demo_data_cleared');
    } catch (error) {
      console.error("Error clearing data:", error);
      setIsLoaded(false);
      analytics.trackEvent('demo_data_cleared');
    }
  };

  const confirmDemoAction = async () => {
    if (pendingConfirmation === 'demo') {
      await loadDemoData();
    }

    if (pendingConfirmation === 'schedule') {
      await loadDemoScheduleOnly();
    }

    setPendingConfirmation(null);
  };

  const confirmationCopy = pendingConfirmation === 'schedule'
    ? {
        title: 'Load Demo Schedule?',
        description: 'This will add the demo event schedule to this device. Use this only for testing or walkthroughs.'
      }
    : {
        title: 'Load Demo Data?',
        description: 'This will inject demo scouting data onto this device, including sample events and entries. Use this only for testing or walkthroughs.'
      };

  return (
    <main className="relative h-screen w-full">
      <div
        className={cn(
          "flex flex-col h-screen w-full justify-center items-center gap-6 2xl:pb-6",
          "bg-size-[40px_40px]",
          "bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)]",
          "dark:bg-[linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]"
        )}
      >
        <div className="flex flex-col w-auto justify-center items-center gap-6 scale-75 md:scale-75 lg:scale-100">
          {logo ? (
            <img
              src={logo}
              width="600"
              height="240"
              alt={`${appName} Logo`}
              className="dark:invert"
            />
          ) : (
            <div className="text-4xl font-bold">{appName}</div>
          )}
          <div className="text-center space-y-2">
            <p>
              <strong>Version</strong>: {version}
            </p>
            <DataAttribution sources={['tba', 'nexus']} variant="compact" />
          </div>
        </div>

        {/* Demo Data Section - Only show if handlers provided */}
        {(onLoadDemoData || onLoadDemoScheduleOnly || onClearData) && (
          <Card className="w-full max-w-md mx-4 mt-8 scale-75 md:scale-100">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <h2 className="text-lg font-semibold">Demo Data</h2>
                <p className="text-sm text-muted-foreground">
                  {demoDataDescription}
                </p>

                {!isLoaded ? (
                  <div className="space-y-2">
                    {onLoadDemoData && (
                      <Button
                        onClick={() => setPendingConfirmation('demo')}
                        disabled={isLoading}
                        className="w-full"
                      >
                        {isLoading && loadingType === 'demo' ? "Loading..." : "Load Demo Data"}
                      </Button>
                    )}
                    {onLoadDemoScheduleOnly && (
                      <Button
                        onClick={() => setPendingConfirmation('schedule')}
                        disabled={isLoading}
                        variant="outline"
                        className="w-full"
                      >
                        {isLoading && loadingType === 'schedule' ? "Loading..." : "Load Demo Schedule"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-sm text-green-600">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {loadedType === 'schedule' ? demoScheduleStats : demoDataStats}
                    </div>
                    {onClearData && (
                      <Button
                        onClick={clearData}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        Clear Data
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <AlertDialog
        open={pendingConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationCopy.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="p-2" disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="p-2" onClick={() => void confirmDemoAction()} disabled={isLoading}>
              {pendingConfirmation === 'schedule' ? 'Load Schedule' : 'Load Demo Data'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white mask-[radial-gradient(ellipse_at_center,transparent_70%,black)] dark:bg-black"></div>
    </main>
  );
};

export default HomePage;
