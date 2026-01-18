import { cn } from "@/core/lib/utils";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";
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
  onClearData?: () => Promise<void>;
  checkExistingData?: () => Promise<boolean>;
  demoDataDescription?: string;
  demoDataStats?: string;
}


const HomePage = ({
  logo,
  appName = "Maneuver",
  version = "1.0.0",
  onLoadDemoData,
  onClearData,
  checkExistingData,
  demoDataDescription = "Load sample scouting data to explore the app's features",
  demoDataStats = "Demo data loaded successfully!"
}: HomePageProps = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

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
  }, [checkExistingData]);

  const loadDemoData = async () => {
    if (!onLoadDemoData) return;

    haptics.medium();
    setIsLoading(true);

    try {
      await onLoadDemoData();
      setIsLoaded(true);
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
        {(onLoadDemoData || onClearData) && (
          <Card className="w-full max-w-md mx-4 mt-8 scale-75 md:scale-100">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <h2 className="text-lg font-semibold">Demo Data</h2>
                <p className="text-sm text-muted-foreground">
                  {demoDataDescription}
                </p>

                {!isLoaded ? (
                  <Button
                    onClick={loadDemoData}
                    disabled={isLoading || !onLoadDemoData}
                    className="w-full"
                  >
                    {isLoading ? "Loading..." : "Load Demo Data"}
                  </Button>
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
                      {demoDataStats}
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
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white mask-[radial-gradient(ellipse_at_center,transparent_70%,black)] dark:bg-black"></div>
    </main>
  );
};

export default HomePage;
