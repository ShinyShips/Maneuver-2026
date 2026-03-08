import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Separator } from "@/core/components/ui/separator";
import { Alert, AlertDescription } from "@/core/components/ui/alert";
import { CheckCircle, Clock, Trash2, WifiOff, AlertTriangle } from 'lucide-react';
import { hasScoreBreakdown, type TBAMatchData } from '@/core/lib/tbaMatchData';
import type { TBACacheMetadata } from '@/core/lib/tbaCache';

interface MatchValidationDataDisplayProps {
  matches: TBAMatchData[];
  cacheMetadata: TBACacheMetadata | null;
  eventKey: string;
  onClearCache: () => void;
  isOnline?: boolean;
  cacheExpired?: boolean;
}

/**
 * Format cache age in human-readable format
 */
function formatCacheAge(timestamp: number): string {
  const ageMs = Date.now() - timestamp;
  const ageMinutes = Math.floor(ageMs / (1000 * 60));
  
  if (ageMinutes < 1) {
    return 'Just now';
  } else if (ageMinutes < 60) {
    return `${ageMinutes} min ago`;
  } else {
    const ageHours = Math.floor(ageMinutes / 60);
    return `${ageHours}h ${ageMinutes % 60}m ago`;
  }
}

/**
 * Display component for match validation data loaded from TBA
 * Shows cache status, match counts, and data availability
 */
export function MatchValidationDataDisplay({
  matches,
  cacheMetadata,
  eventKey,
  onClearCache,
  isOnline = true,
  cacheExpired = false,
}: MatchValidationDataDisplayProps) {
  const qualMatches = matches.filter(m => m.comp_level === 'qm');
  const playoffMatches = matches.filter(m => m.comp_level !== 'qm');
  const matchesWithBreakdown = matches.filter(hasScoreBreakdown).length;
  
  // Extract available validation fields from score breakdown
  // This is year-agnostic - it automatically detects what data is available
  const getAvailableFields = (): string[] => {
    const matchWithBreakdown = matches.find(m => hasScoreBreakdown(m));
    if (!matchWithBreakdown || !hasScoreBreakdown(matchWithBreakdown)) return [];
    
    // Type assertion needed because hasScoreBreakdown doesn't narrow the type
    const breakdown = (matchWithBreakdown as TBAMatchData & { score_breakdown: Record<string, any> }).score_breakdown;
    const redAlliance = breakdown?.red || {};
    
    // Get all top-level keys from the score breakdown
    return Object.keys(redAlliance).filter(key => {
      // Filter out non-field data (metadata, computed totals, etc.)
      const metadataKeys = [
        'rp', 'totalPoints', 'foulPoints', 'adjustPoints', 
        'foulCount', 'techFoulCount', 'tba_gameData'
      ];
      return !metadataKeys.includes(key);
    });
  };
  
  const availableFields = getAvailableFields();
  
  // Format field name for display (camelCase to Title Case)
  const formatFieldName = (field: string): string => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Match Validation Data
          {!isOnline && (
            <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
              <WifiOff className="h-4 w-4" />
              Offline
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Detailed match breakdowns cached for validation against scouting data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {matches.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-muted-foreground">
              No validation data loaded yet.
            </p>
            <p className="text-sm text-muted-foreground">
              {isOnline 
                ? "Click \"Load Match Validation Data\" above to fetch detailed match breakdowns from TBA."
                : "You are offline. Load data while online to cache it for offline use."
              }
            </p>
          </div>
        ) : (
          <>
            {/* Offline/Stale Data Warning */}
            {(!isOnline || cacheExpired) && (
              <Alert variant={!isOnline ? "default" : "destructive"}>
                {!isOnline ? <WifiOff className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <AlertDescription>
                  {!isOnline 
                    ? "You are offline. Showing cached data from your last online session."
                    : "Cache expired. Data may be stale. Connect to internet and reload for fresh data."
                  }
                </AlertDescription>
              </Alert>
            )}
            {/* Match Count Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Matches</p>
                <p className="text-2xl font-bold">{matches.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Qualification</p>
                <p className="text-2xl font-bold">{qualMatches.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Playoff</p>
                <p className="text-2xl font-bold">{playoffMatches.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">With Breakdowns</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {matchesWithBreakdown}
                </p>
              </div>
            </div>
            
            <Separator />
            
            {/* Cache Information */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Cache Status
              </h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  Event: <span className="font-medium text-foreground">{eventKey}</span>
                </p>
                <p>
                  Last Updated: <span className="font-medium text-foreground">
                    {cacheMetadata 
                      ? formatCacheAge(cacheMetadata.lastFetchedAt)
                      : 'Unknown'
                    }
                  </span>
                </p>
                <p className="text-xs">
                  {isOnline 
                    ? "Cache persists offline. Data refreshes automatically when you reload while online."
                    : "Cache preserved for offline use. Data will refresh when you're back online."
                  }
                </p>
              </div>
            </div>
            
            <Separator />
            
            {/* Available Data Fields - Year-Agnostic */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Available Validation Fields</h4>
              {availableFields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availableFields.map(field => (
                    <div key={field} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">{formatFieldName(field)}</p>
                        <p className="text-xs text-muted-foreground">From TBA score breakdown</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Score breakdown fields will appear here when match data is loaded
                </p>
              )}
            </div>
            
            <Separator />
            
            {/* Actions */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {isOnline 
                  ? "This data will be used to compare against your scouted entries and identify discrepancies."
                  : "This cached data is available offline for validation. Reconnect to refresh."
                }
              </p>
              <Button 
                variant="outline" 
                onClick={onClearCache}
                className="w-full"
                size="sm"
                disabled={!isOnline}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isOnline ? "Clear Validation Cache" : "Clear Cache (requires internet)"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
