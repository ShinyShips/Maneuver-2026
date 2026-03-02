import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import {
  getCachedEventStatboticsEPA,
  getCachedStatboticsFetchedAt,
  type StatboticsEPAMetrics,
} from '@/core/lib/statbotics/epaUtils';

interface StatboticsEPADataDisplayProps {
  eventKey: string;
  refreshKey?: number;
}

function formatAge(timestamp: number): string {
  const ageMs = Date.now() - timestamp;
  const ageMinutes = Math.floor(ageMs / (1000 * 60));

  if (ageMinutes < 1) return 'Just now';
  if (ageMinutes < 60) return `${ageMinutes} min ago`;

  const ageHours = Math.floor(ageMinutes / 60);
  return `${ageHours}h ${ageMinutes % 60}m ago`;
}

export const StatboticsEPADataDisplay: React.FC<StatboticsEPADataDisplayProps> = ({
  eventKey,
  refreshKey = 0,
}) => {
  const [metricsByTeam, setMetricsByTeam] = React.useState<Map<number, StatboticsEPAMetrics>>(new Map());
  const [fetchedAt, setFetchedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!eventKey.trim()) {
      setMetricsByTeam(new Map());
      setFetchedAt(null);
      return;
    }

    setMetricsByTeam(getCachedEventStatboticsEPA(eventKey));
    setFetchedAt(getCachedStatboticsFetchedAt(eventKey));
  }, [eventKey, refreshKey]);

  const sortedTeams = [...metricsByTeam.entries()].sort((a, b) => b[1].totalPoints - a[1].totalPoints);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Statbotics EPA Breakdown
          <Badge variant="outline" className="ml-auto">{eventKey || 'No Event'}</Badge>
        </CardTitle>
        <CardDescription>
          Team-event EPA breakdown cache used by Team Stats (similar to TBA COPRs)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedTeams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Statbotics EPA data cached yet. Load Match Validation Data to fetch team-event EPA breakdowns.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Teams Cached</p>
                <p className="text-2xl font-bold">{sortedTeams.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Total EPA</p>
                <p className="text-2xl font-bold">
                  {(
                    sortedTeams.reduce((sum, [, metrics]) => sum + metrics.totalPoints, 0) / sortedTeams.length
                  ).toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Auto EPA</p>
                <p className="text-2xl font-bold">
                  {(
                    sortedTeams.reduce((sum, [, metrics]) => sum + metrics.autoPoints, 0) / sortedTeams.length
                  ).toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm font-medium">{fetchedAt ? formatAge(fetchedAt) : 'Unknown'}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-2">Team</th>
                    <th className="py-2 pr-2">Total</th>
                    <th className="py-2 pr-2">Auto</th>
                    <th className="py-2 pr-2">Teleop</th>
                    <th className="py-2">Endgame</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeams.slice(0, 12).map(([teamNumber, metrics]) => (
                    <tr key={teamNumber} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">{teamNumber}</td>
                      <td className="py-2 pr-2">{metrics.totalPoints.toFixed(1)}</td>
                      <td className="py-2 pr-2">{metrics.autoPoints.toFixed(1)}</td>
                      <td className="py-2 pr-2">{metrics.teleopPoints.toFixed(1)}</td>
                      <td className="py-2">{metrics.endgamePoints.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
